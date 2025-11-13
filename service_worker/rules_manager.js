// מודול זה אחראי על ניהול חוקי declarativeNetRequest לשינוי כותרות עוגיות.

const STARTING_RULE_ID = 1000;

/**
 * יוצר מערך של חוקי declarativeNetRequest על בסיס רשימת דומיינים.
 * לכל דומיין ניצור 2 חוקים: אחד שמחליף הגדרה קיימת, ואחד שמוסיף הגדרה חסרה.
 * המערכת מסתמכת על עדיפויות (priority) כדי לבחור את החוק הנכון.
 * @param {string[]} domains - מערך של דומיינים להחלת החוקים.
 * @returns {chrome.declarativeNetRequest.Rule[]}
 */
function createRulesForDomains(domains) {
  const rules = [];
  let currentId = STARTING_RULE_ID;

  for (const domain of domains) {
    // חוק מס' 1: "המתקן" - בעל עדיפות גבוהה
    // מופעל רק אם הכותרת כבר מכילה הגדרת SameSite.
    rules.push({
      id: currentId++,
      priority: 2, // עדיפות גבוהה
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          {
            header: 'set-cookie',
            "regexSubstitution": {
              "regex": "SameSite=(Lax|Strict)",
              "substitution": "SameSite=None; Secure",
              "case": "insensitive"
            }
          }
        ]
      },
      condition: {
        requestDomains: [domain],
        // תנאי תקין: החל רק אם הכותרת מכילה את המחרוזת.
        "responseHeaders": [
            { "header": "Set-Cookie", "valueContains": "SameSite=" }
        ],
        "isUrlFilterCaseSensitive": false
      }
    });

    // חוק מס' 2: "המוסיף" - בעל עדיפות נמוכה
    // מופעל על כל תגובה מהדומיין, אך ייבחר רק אם חוק מס' 1 לא התאים.
    rules.push({
      id: currentId++,
      priority: 1, // עדיפות נמוכה
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          {
            header: 'set-cookie',
            operation: 'append',
            value: '; SameSite=None; Secure'
          }
        ]
      },
      condition: {
        requestDomains: [domain]
        // <<< שינוי עיקרי: התנאי השגוי 'excludedResponseHeaders' הוסר לחלוטין. >>>
        // החוק הזה יתאים לכל תגובה מהדומיין, והעדיפות הנמוכה שלו תדאג שהוא
        // יפעל רק כשצריך.
      }
    });
  }

  return rules;
}

/**
 * מנקה את כל החוקים הישנים ומחיל קבוצת חוקים חדשה.
 * @param {string[]} domains - רשימת הדומיינים החדשה להחלת החוקים.
 */
export async function updateCookieRules(domains) {
  const rules = createRulesForDomains(domains);

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIdsToRemove = existingRules.map(rule => rule.id)
                                        .filter(id => id >= STARTING_RULE_ID);
  
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove,
      addRules: rules
    });
    console.log(`TheChannel Viewer: עודכנו ${rules.length} חוקי עוגיות כלליים עבור ${domains.length} דומיינים.`);
  } catch (error) {
    console.error("TheChannel Viewer: שגיאה קריטית בעדכון חוקי הרשת.", error);
    // קוד הגיבוי נשאר למקרה של דפדפן ישן מאוד
    console.log("TheChannel Viewer: ייתכן שהדפדפן אינו תומך ב-regexSubstitution. חוזר לשיטה הבסיסית.");
    const basicRules = createBasicRulesForDomains(domains);
     await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIdsToRemove,
      addRules: basicRules
    });
  }
}

// פונקציית גיבוי למקרה ש-regexSubstitution לא נתמך.
function createBasicRulesForDomains(domains) {
    let rules = [];
    let currentId = STARTING_RULE_ID;
     for (const domain of domains) {
        rules.push({
          id: currentId++,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [{ header: 'set-cookie', operation: 'append', value: '; SameSite=None; Secure' }]
          },
          condition: {
            requestDomains: [domain]
            // כאן בכוונה אין תנאי מורכב, כי זהו מצב גיבוי פשוט
          }
        });
    }
    return rules;
}