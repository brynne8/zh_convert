import zh2hans from './zh2hans.js';
import zh2cn from './zh2cn.js';

let trie = {}
let titleRule = null

const convPattern = /-\{(.*?)\}-/g
const varPattern = /^\s*(zh(?:-[a-z]{2,4})?):\s*(.*)/
const varFallback = {
  'zh-hans': ['zh'],
  'zh-hant': ['zh'],
  'zh-cn': ['zh-hans', 'zh'],
  'zh-tw': ['zh-hant', 'zh-hk', 'zh'],
  'zh-hk': ['zh-hant', 'zh-tw', 'zh'],
}

function addSingleConv(from, to) {
  let curNode = trie;
  for (const c of from) {
    if (!curNode[c]) {
      curNode[c] = {};
    }
    curNode = curNode[c];
  }
  curNode._ = to;
}

function addConversionData(data) {
  for (const pair of zh2hans) {
    addSingleConv(pair[0], pair[1]);
  }
}

function mergeGlobalRules(data, variant) {
  if (data.T) {
    titleRule = data.T;
  }
  for (const rule of data.rules) {
    const langExprs = rule.split(';');
    const langMap = {};
    let oneWaySuccess = false;
    for (const expr of langExprs) {
      let matched = expr.match(/^(.+?)=>(.+)/)
      if (matched) {
        // one-way conversion
        let from = matched[1].trim();
        let to = matched[2].trim();
        if (from.substring(0, 2) === 'zh' || to.substring(0, 2) !== 'zh') {
          continue; // rule error
        }
        const found = to.match(varPattern);
        if (found && found[1] === variant) {
          addSingleConv(from, found[2]);
          oneWaySuccess = true;
          break;
        }
        continue;
      } else {
        const found = expr.match(varPattern);
        if (found) {
          langMap[found[1]] = found[2].trim();
        } else {
          let newDefault = expr.trim();
          if (newDefault) {
            langMap['default'] = newDefault;
          }
        }
      }
    }
    if (oneWaySuccess || Object.keys(langMap).length === 0) continue;

    if (langMap[variant]) {
      for (const langVar in langMap) {
        if (langVar !== variant) {
          addSingleConv(langMap[langVar], langMap[variant]);
        }
      }
      continue;
    }
    if (varFallback[variant]) {
      for (const fallback of varFallback[variant]) {
        if (langMap[fallback]) {
          for (const langVar in langMap) {
            if (langVar !== fallback) {
              addSingleConv(langMap[langVar], langMap[fallback]);
            }
          }
        }
      }
    } else {
      debugger;
    }
  }
}

addConversionData(zh2hans);
addConversionData(zh2cn);

$('noteta').each((_, x) => {
  mergeGlobalRules(JSON.parse(x.textContent), 'zh-cn');
}).remove();

function doConvert(str) {
  let cursor = 0;
  let strlen = str.length;
  const resList = [];
  
  let getMap = function() {
    let start = cursor;
    let matched = [];
    let curNode = trie;
    while (true) {
      if (cursor === strlen) break;
      let result = curNode[str[cursor]];
      if (!result) break;
      curNode = result;
      cursor++;
      result._cursor = cursor;
      matched.push(result);
    }
    let curMatchIndex = matched.length - 1;
    
    while (curMatchIndex >= 0) {
      let curMatch = matched[curMatchIndex];
      if (curMatch && curMatch._) {
        resList.push(curMatch._);
        cursor = curMatch._cursor
        return;
      }
      curMatchIndex--;
    }
    // when no matches can be used
    resList.push(str[start]);
    cursor = start + 1;
  }
  
  while (cursor < strlen) {
    getMap();
  }
  
  return resList.join('');
}

function pickVariant(str, variant) {
  str = str.trim();
  const rules = str.split(';');
  const ruleMap = {};
  for (let rule of rules) {
    const found = rule.match(varPattern);
    if (found) {
      ruleMap[found[1]] = found[2].trim();
    } else {
      let newDefault = rule.trim();
      if (newDefault) {
        ruleMap['default'] = newDefault;
      }
    }
  }
  if (Object.keys(ruleMap).length === 0) {
    ruleMap['default'] = str;
  }
  
  if (ruleMap[variant]) {
    return ruleMap[variant];
  }
  for (const fallback of varFallback[variant]) {
    if (ruleMap[fallback]) {
      return ruleMap[fallback];
    }
  }
  return ruleMap['default'] || '';
}

function doMwConvert(str) {
  const matches = str.matchAll(convPattern);
  let matchEnd = 0;
  const resList = [];
  for (const match of matches) {
    resList.push(doConvert(str.substring(matchEnd, match.index)));
    resList.push(pickVariant(match[1], 'zh-cn'))
    matchEnd = match.index + match[0].length;
  }
  resList.push(doConvert(str.substring(matchEnd, str.length)));
  
  return resList.join('')
}

export default doMwConvert;
