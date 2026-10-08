/* A saved exam is not a complete course result while coursework is unrecorded. */
function isCourseworkFieldEntered(g,week,field){if(!g)return false;const key=week+'_'+field,flag=g[key+'Entered']??g[week]?.[field+'Entered'],value=g[week]?.[field]??g[key];if(flag===false)return false;if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return false;return flag===true||Number(value)>0;}
function isGradeComplete(g){return isExamEntered(g)&&['w1','w2','w3','w4'].every(w=>['attend','hw','disc'].every(f=>isCourseworkFieldEntered(g,w,f)));}
function gradeFieldDisplay(g,week,field){return isCourseworkFieldEntered(g,week,field)?String(g[week]?.[field]??g[week+'_'+field]):'لم تُرصد';}
