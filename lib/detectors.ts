import { Finding } from './types.js';

interface FunctionDef {
  name: string;
  startLine: number;
  endLine: number;
  signature: string;
  visibility: 'public' | 'external' | 'internal' | 'private' | 'default';
  modifiers: string[];
  hasNonReentrant: boolean;
  hasOwnerAuth: boolean;
  body: string;
  bodyLines: { lineNum: number; text: string }[];
}

export function extractFunctions(source: string): FunctionDef[] {
  const lines = source.split(/\r?\n/);
  const functions: FunctionDef[] = [];

  // Strip comments and track char positions while mapping to lines
  let inBlockComment = false;
  let inString: string | null = null;
  let braceDepth = 0;
  let currentFunc: Partial<FunctionDef> | null = null;
  let currentFuncBodyLines: { lineNum: number; text: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Simple line inspection for function start if not inside another function
    if (!currentFunc && !inBlockComment) {
      const funcMatch = line.match(/\bfunction\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)([^;{]*)/);
      if (funcMatch && line.includes('{')) {
        const name = funcMatch[1];
        const rest = (funcMatch[3] || '').trim();
        const fullSig = (funcMatch[0] || '').trim();

        const visibility: FunctionDef['visibility'] =
          /\bexternal\b/.test(rest) ? 'external' :
          /\bpublic\b/.test(rest) ? 'public' :
          /\binternal\b/.test(rest) ? 'internal' :
          /\bprivate\b/.test(rest) ? 'private' : 'default';

        const hasNonReentrant = /\bnonReentrant\b/.test(rest);
        const hasOwnerAuth = /\b(onlyOwner|onlyRole|auth|restricted|onlyAdmin)\b/.test(rest);

        currentFunc = {
          name,
          startLine: lineNum,
          signature: fullSig,
          visibility,
          modifiers: rest.split(/\s+/).filter(Boolean),
          hasNonReentrant,
          hasOwnerAuth,
        };
        currentFuncBodyLines = [{ lineNum, text: line }];
        braceDepth = 0;

        for (let char of line) {
          if (char === '{') braceDepth++;
          else if (char === '}') braceDepth--;
        }

        if (braceDepth === 0) {
          // Closed on same line
          functions.push({
            ...currentFunc,
            endLine: lineNum,
            body: line,
            bodyLines: currentFuncBodyLines,
          } as FunctionDef);
          currentFunc = null;
          currentFuncBodyLines = [];
        }
        continue;
      }
    }

    if (currentFunc) {
      currentFuncBodyLines.push({ lineNum, text: line });
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];

        if (inBlockComment) {
          if (char === '*' && nextChar === '/') {
            inBlockComment = false;
            j++;
          }
          continue;
        }

        if (inString) {
          if (char === '\\') {
            j++;
          } else if (char === inString) {
            inString = null;
          }
          continue;
        }

        if (char === '/' && nextChar === '/') {
          break; // Rest of line is comment
        }
        if (char === '/' && nextChar === '*') {
          inBlockComment = true;
          j++;
          continue;
        }
        if (char === '"' || char === "'") {
          inString = char;
          continue;
        }

        if (char === '{') {
          braceDepth++;
        } else if (char === '}') {
          braceDepth--;
          if (braceDepth <= 0) {
            const bodyText = currentFuncBodyLines.map((l) => l.text).join('\n');
            const hasRequireAuth =
              /\brequire\s*\([^;]*(msg\.sender\s*==|==\s*msg\.sender|owner\s*==|hasRole)/.test(bodyText) ||
              /\bif\s*\([^;]*(msg\.sender\s*!=|owner\s*!=)/.test(bodyText);

            functions.push({
              ...currentFunc,
              endLine: lineNum,
              hasOwnerAuth: (currentFunc.hasOwnerAuth || hasRequireAuth),
              body: bodyText,
              bodyLines: [...currentFuncBodyLines],
            } as FunctionDef);

            currentFunc = null;
            currentFuncBodyLines = [];
            break;
          }
        }
      }
    }
  }

  return functions;
}

export function runRuleDetectors(source: string): Finding[] {
  const findings: Finding[] = [];
  const lines = source.split(/\r?\n/);
  const functions = extractFunctions(source);

  // 1. Check pragma for Solidity < 0.8 without SafeMath
  let pragmaLine = 1;
  let hasOldPragma = false;
  let hasSafeMath = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bpragma\s+solidity\b/.test(line)) {
      pragmaLine = i + 1;
      const match = line.match(/\bpragma\s+solidity\s+([^;]+);/);
      if (match) {
        const verStr = match[1];
        if (
          /\^0\.[1-7]\./.test(verStr) ||
          />=\s*0\.[1-7]\./.test(verStr) ||
          /<0\.8/.test(verStr) ||
          /0\.[4-7]\./.test(verStr)
        ) {
          hasOldPragma = true;
        }
      }
    }
    if (/\busing\s+SafeMath\b/.test(line) || /\bSafeMath\b/.test(line)) {
      hasSafeMath = true;
    }
  }

  if (hasOldPragma && !hasSafeMath) {
    findings.push({
      id: `rule-overflow-${pragmaLine}`,
      name: 'Arithmetic Overflow/Underflow Without SafeMath',
      severity: 'High',
      line: pragmaLine,
      description:
        'Solidity version is prior to 0.8.0 without using SafeMath for arithmetic operations. Arithmetic operations will silently overflow or underflow.',
      fix: "Upgrade pragma to '^0.8.20' or higher where checked arithmetic is built into the language, or import OpenZeppelin SafeMath and apply 'using SafeMath for uint256;'.",
      origin: 'rule',
      ruleCategory: 'overflow',
    });
  }

  // 2. tx.origin used for authorization
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isComment = /^\s*(\/\/|\/\*|\*)/.test(line);
    if (!isComment && /\btx\.origin\b/.test(line)) {
      if (
        /\brequire\s*\(/.test(line) ||
        /\bif\s*\(/.test(line) ||
        /\bassert\s*\(/.test(line) ||
        /==\s*tx\.origin/.test(line) ||
        /tx\.origin\s*==/.test(line) ||
        /!=\s*tx\.origin/.test(line) ||
        /tx\.origin\s*!=/.test(line)
      ) {
        findings.push({
          id: `rule-txorigin-${i + 1}`,
          name: 'Vulnerable Use of tx.origin',
          severity: 'High',
          line: i + 1,
          description:
            'tx.origin is used for authorization instead of msg.sender. If an authorized account is tricked into interacting with a malicious intermediary contract, the attacker can drain or manipulate the contract.',
          fix: 'Replace tx.origin with msg.sender to verify the immediate caller.',
          origin: 'rule',
          ruleCategory: 'tx-origin',
        });
      }
    }
  }

  // 3. Unchecked low-level send / call return value
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isComment = /^\s*(\/\/|\/\*|\*)/.test(line);
    if (isComment) continue;

    // Direct .send(...) statement that ignores return value
    if (/\.send\s*\([^)]*\)\s*;/.test(line) && !/require\s*\([^;]*\.send/.test(line)) {
      findings.push({
        id: `rule-unchecked-send-${i + 1}`,
        name: 'Unchecked Return Value on send',
        severity: 'Medium',
        line: i + 1,
        description:
          'Low-level send() call return value is not checked. If transfer fails or exceeds 2300 gas, it returns false without reverting, leading to silent payment failure.',
        fix: 'Wrap send in a require statement, e.g., require(recipient.send(amount), "Transfer failed");, or use Address.sendValue.',
        origin: 'rule',
        ruleCategory: 'unchecked-call',
      });
    }

    // Bare .call(...) with return value discarded completely
    if (
      /^[ \t]*[a-zA-Z0-9_.]+\.call\s*(\{[^}]*\})?\s*\([^)]*\)\s*;/m.test(line) &&
      !/\(bool\s+/.test(line) &&
      !/require\s*\(/.test(line)
    ) {
      findings.push({
        id: `rule-unchecked-call-${i + 1}`,
        name: 'Unchecked Low-Level Call Return Value',
        severity: 'Medium',
        line: i + 1,
        description:
          'The return value of low-level call() is discarded. If the external invocation fails, execution proceeds normally.',
        fix: 'Capture the boolean return value: (bool success, ) = target.call(...); and assert success with require(success, "Call failed");',
        origin: 'rule',
        ruleCategory: 'unchecked-call',
      });
    }
  }

  // 4. Function-level checks (Reentrancy, Selfdestruct, Delegatecall, Sensitive Access Control)
  for (const fn of functions) {
    // A. Reentrancy: external .call before state modification
    if (!fn.hasNonReentrant) {
      let callLine = -1;
      let stateMutationLine = -1;

      for (const lineObj of fn.bodyLines) {
        const text = lineObj.text;
        const isComment = /^\s*(\/\/|\/\*|\*)/.test(text);
        if (isComment) continue;

        // Detect external call
        if (/\.call\s*(\{[^}]*\}|\([^)]*\))/.test(text) && !/address\(this\)/.test(text)) {
          if (callLine === -1) {
            callLine = lineObj.lineNum;
          }
        }

        // Detect state variable write (assignments like balances[...] -= or stateVar =)
        if (callLine !== -1 && lineObj.lineNum > callLine) {
          const isMutation =
            /(\w+(\[[^\]]+\])?\s*(\+=|-=|\*=|\/=|%=|=)(?!=))/.test(text) &&
            !/\b(bool|uint\w*|int\w*|address|bytes\w*|string|memory)\s+\w+/.test(text);

          if (isMutation && stateMutationLine === -1) {
            stateMutationLine = lineObj.lineNum;
          }
        }
      }

      if (callLine !== -1 && stateMutationLine !== -1) {
        findings.push({
          id: `rule-reentrancy-${callLine}`,
          name: 'Reentrancy Vulnerability',
          severity: 'Critical',
          line: callLine,
          description: `External call on line ${callLine} is executed before updating state variables on line ${stateMutationLine}. A malicious contract can recursively call back into this function before state is updated.`,
          fix: "Apply the Checks-Effects-Interactions pattern by updating state variables before transferring Ether, or inherit OpenZeppelin's ReentrancyGuard and add the nonReentrant modifier.",
          origin: 'rule',
          ruleCategory: 'reentrancy',
        });
      }
    }

    // B. Unprotected selfdestruct
    for (const lineObj of fn.bodyLines) {
      const text = lineObj.text;
      const isComment = /^\s*(\/\/|\/\*|\*)/.test(text);
      if (isComment) continue;

      if (/\b(selfdestruct|suicide)\s*\(/.test(text)) {
        if (!fn.hasOwnerAuth) {
          findings.push({
            id: `rule-selfdestruct-${lineObj.lineNum}`,
            name: 'Unprotected Selfdestruct',
            severity: 'Critical',
            line: lineObj.lineNum,
            description:
              'Function contains selfdestruct without authorization checks. Any address can invoke this function to destroy the contract and claim its funds.',
            fix: "Add an access control modifier such as onlyOwner or verify that msg.sender == owner before allowing selfdestruct.",
            origin: 'rule',
            ruleCategory: 'selfdestruct',
          });
        }
      }

      // C. Unprotected delegatecall
      if (/\.delegatecall\s*\(/.test(text)) {
        if (!fn.hasOwnerAuth) {
          findings.push({
            id: `rule-delegatecall-${lineObj.lineNum}`,
            name: 'Unprotected Delegatecall',
            severity: 'High',
            line: lineObj.lineNum,
            description:
              'Arbitrary delegatecall execution without caller authorization. A caller can execute arbitrary malicious bytecode in the context of this contract, overwriting storage or draining funds.',
            fix: "Add an access control modifier (such as onlyOwner) or restrict delegatecall targets to a trusted immutable registry.",
            origin: 'rule',
            ruleCategory: 'delegatecall',
          });
        }
      }
    }

    // D. Missing access control on sensitive public functions
    const isSensitiveName =
      /^(set[A-Z0-9_]|mint[A-Z0-9_]*|burn[A-Z0-9_]*|transferOwnership|upgrade[A-Z0-9_]*|pause[A-Z0-9_]*)/.test(
        fn.name
      );

    if (isSensitiveName && (fn.visibility === 'public' || fn.visibility === 'external')) {
      if (!fn.hasOwnerAuth) {
        findings.push({
          id: `rule-access-control-${fn.startLine}`,
          name: 'Missing Access Control on Sensitive Function',
          severity: 'High',
          line: fn.startLine,
          description: `Sensitive administrative function '${fn.name}' is declared ${fn.visibility} without access control modifiers (onlyOwner, onlyRole) or caller authorization checks.`,
          fix: `Add an access control modifier such as onlyOwner or add require(msg.sender == owner, "Unauthorized"); at the start of '${fn.name}'.`,
          origin: 'rule',
          ruleCategory: 'access-control',
        });
      }
    }
  }

  return findings;
}
