var firstParty_get = "u";
var firstParty_delete = "u";
var thirdParty_get = "u";
var thirdParty_delete = "u";

var flag = false;
var ccpa1 = "undefined";
var originHostName = "undefined";

/**************************************************************************************************
 *                                          Initialization                                        *       
 **************************************************************************************************
 */

function initialize() {
    setupHeaderModListener();
    setInitialCCPARule();
}

initialize();


function setInitialCCPARule() {
    getDefaultPreference().then(data => {
        if (!data) {
            return;
        } else {
            var defaultPreference = data.default;
            // if user allows to sell, allowAllToSellFlag should be set as true
            if (defaultPreference == 0) {
                flag = 0;
                ccpa1 = "uu0";
            } else {
                flag = 1;
                ccpa1 = "uu1";
            }
        }
    });
}

function setupHeaderModListener() {

    chrome.webRequest.onBeforeSendHeaders.addListener(
        modifyRequestHeaderHandler,
        { urls: ["<all_urls>"] },
        ["blocking", "requestHeaders"]
    );

    chrome.webRequest.onSendHeaders.addListener(details => {
        console.log(details);
        // getThirdPartyList().then().catch();
        // getFirstPartyList().then().catch();
    },
        { urls: ["<all_urls>"] },
        ['extraHeaders', 'requestHeaders']
    );

/**
 * Response Handler: Check if CCPA header in the response
 */ 
    chrome.webRequest.onHeadersReceived.addListener(details =>{
        var header = details.responseHeaders
        for(var i=0;i<header.length;i++){
            console.log("response",details)
            if(header[i].name == "ccpa1"){
                
                console.log("ccpa header received")
                if (details.url=='http://www.ccpabrowsertool.com/'){
                chrome.tabs.create({
                    url: chrome.runtime.getURL('./skin/response.html'),
                    active: false
                }, function(tab) {
                    chrome.windows.create({
                        tabId: tab.id,
                        type: "panel",
                        focused: false,
                        width:400
                    });
                }
                
                );}
                break
            }
        }
    },
    { urls: ["<all_urls>"] }
    ,["responseHeaders"])   
}

/***************************************************************************************************
 *                                  Modify HTTP Request Hander                                     *       
 ***************************************************************************************************
 */

function modifyRequestHeaderHandler(details) {
    if (details.initiator !== undefined && details.initiator.startsWith("chrome-extension")) {
        return {};
    }
    isThirdPartyURL(details.url)
    .then(getCCPARule)
    .then(ccpaRule => {
        ccpa1 = ccpaRule;
    });
    details.requestHeaders.push({ name: "ccpa1", value: ccpa1 });
    return { requestHeaders: details.requestHeaders };
}

/**
 * Return the hostname of current request url
 * @param {} requestURL current request url
 * 1. tab.url stands for the origin url that user wants to visit
 * 2. originHostName: origin hostname
 * 3. requestHostName: hostname of each http request url
 * return the correponding hostname
 */
function isThirdPartyURL(requestURL) {
    return new Promise((resolve, reject) => {
        var requestHostName = new URL(parseOriginURL(requestURL)).hostname;
        chrome.tabs.getSelected(null, (tab) => {
            if (/^https:./.test(tab.url) || /^http:./.test(tab.url)) {
                originHostName = new URL(parseOriginURL(tab.url)).hostname;
                // if hostname of each http request url 
                // equals to the origin url that user wants to visit
                if (requestHostName == originHostName) {
                    return resolve(originHostName);
                } else {
                    return resolve(requestHostName);
                }
            }
        })
    })
}

/**
 * Get corresponding CCPA rule in different scenarios.
 * @param {*} hostname hostname or domain of request url.
 */
function getCCPARule(hostname) {
    if (hostname != originHostName) {
        // for third party request, get user's default preference first
        getDefaultPreference().then(setAllowAllToSell);
        // TODO: 
        // store third party's request url to storage
        addToThirdPartyList(hostname).then().catch();
        // then construct ccpa rule based on user's default or customized preference
        return isInExceptionListHelper(hostname).then(constructThirdPartyCCPARule);
    } else {
        // for first party, construct ccpa rule based on user's customized preference
        addToFirstPartyList(hostname).then().catch();
        return isInExceptionListHelper(originHostName).then(constructFirstPartyCCPARule);
    }
}

/**
 * Store all third party's hostname to storage
 * @param  hostname current third party's hostname
 */
function addToThirdPartyList(hostname) {
    return new Promise((resolve, reject) => {
		chrome.storage.local.get("thirdPartyList", data => {
            var thirdPartyList = data.thirdPartyList
            if(thirdPartyList) {
                thirdPartyList = thirdPartyList.filter(p => p !== hostname)
                thirdPartyList.push(hostname)
            } else {
                thirdPartyList = [hostname]
            }
            chrome.storage.local.set({ thirdPartyList }, () => 
                chrome.runtime.lastError ?
                reject(Error(chrome.runtime.lastError.message)) :
                resolve()
            )
        })
	})
}


// function updateThirdPartyList() {
//     getFirstPartyList().then()
// }


function addToFirstPartyList(hostname) {
    return new Promise((resolve, reject) => {
		chrome.storage.sync.get("firstPartyList", data => {
            var firstPartyList = data.firstPartyList
            if(firstPartyList) {
                firstPartyList = firstPartyList.filter(p => p !== hostname)
                firstPartyList.push(hostname)
            } else {
                firstPartyList = [hostname]
            }
            chrome.storage.sync.set({ firstPartyList }, () => 
                chrome.runtime.lastError ?
                reject(Error(chrome.runtime.lastError.message)) :
                resolve()
            )
        })
	})
}



function getThirdPartyList() {
    return new Promise((resolve, reject) => {
		chrome.storage.local.get("thirdPartyList", data => {
            console.log("3rd");
            console.log(data);
            resolve(data);
        })
	})
}

function getFirstPartyList() {
    return new Promise((resolve, reject) => {
		chrome.storage.sync.get("firstPartyList", data => {
            console.log("1st");
            console.log(data);
        })
	})
}

function isInExceptionListHelper(hostname) {
    return new Promise(resolve => {
        var inExceptionList;
        chrome.storage.local.get('customPreferences', (data) => {
            var customPreferences = data.customPreferences
            if (customPreferences) {
                var filteredPreference = customPreferences.filter(
                    (p) => p.domain == hostname
                )
                // the hostname does not in the user's exception list
                // which means user does not have customized preference for it.
                if (filteredPreference.length == 0) {
                    inExceptionList = false
                } else {
                    inExceptionList = true
                }
            } else {
                inExceptionList = false
            }
            return resolve(inExceptionList);
        })
    })
}


/**
 * Construct third party's ccpa rule
 * 1. if the request's hostname is in the ExceptionList or user allows to sell by default,
 *    ccpa rule would be set as "uu0", meaning user allows to sell information, but does not set 
 *    any preference for requesting or deleting information.
 *    Otherwise, ccpa rule would be set as "uu1".
 * 2. store every request into storage for analysis purpose.
 * @param isInExceptionList true stands for allowing to sell data; false stands for not allowing.
 */
function constructThirdPartyCCPARule(isInExceptionList) {
    return new Promise(resolve => {
        var ccpa;
        if(!(isInExceptionList ^ flag)) {
            ccpa = thirdParty_get + thirdParty_delete + "0";
            console.log("3rd rr0");
        } else {
            ccpa = thirdParty_get + thirdParty_delete + "1";
            console.log("3rd rr1");
        }
        return resolve(ccpa);
    })
}

/**
 * Construct first party's ccpa rule based on customized preference
 * 1. if the request's hostname is in the ExceptionList, ccpa rule would be set as "r1 r2 0", 
 *    Otherwise, ccpa rule would be set as "r1 r2 1".
 *    Value of r1 r2 based on user's preference from front-end.
 * 2. store every request into storage for analysis purpose.
 * @param isInExceptionList true stands for allowing to sell data; false stands for not allowing.
 */
function constructFirstPartyCCPARule(isInExceptionList) {
    return new Promise(resolve => {
        var ccpa;
        if(!(isInExceptionList ^ flag)) {
            ccpa = firstParty_get + firstParty_delete + "0";
            console.log("1st rr0");
        } else {
            ccpa = firstParty_get + firstParty_delete + "1";
            console.log("1st rr1");
        }
        return resolve(ccpa);
    })
}

/**
 * Set user's default preference of selling information.
 * @param defaultPreference 0 => allow selling my data; 1 => do not sell my data.
 */
function setAllowAllToSell(defaultPreference) {
    if (!defaultPreference) {
        return;
    }
    if (defaultPreference.default == 0) {
        flag = 0
    } else {
        flag = 1;
    }
    return flag;
}


/****************************************************************************************************
 *                                      General Methods                                             *       
 ****************************************************************************************************
 */

/**
 * Return the url that matches specific pattern.
 * Otherwise, return null.
 * @param url given url
 */
function parseOriginURL(url) {
    var result = url.match(/^[\w-]+:\/{2,}\[?[\w\.:-]+\]?(?::[0-9]*)?/);
    if (result) {
        return result[0];
    }
    return null;
}


function refreshPage() {
    chrome.tabs.getSelected(null, function (tab) {
        if (tab == null || tab.id == null || tab.id < 0) {
            return;
        }
        var code = 'window.location.reload();';
        chrome.tabs.executeScript(tab.id, { code: code });
        console.log("refresh");
    });
}


/***************************************************************************************************
 *                                     Message Handler                                             *       
 ***************************************************************************************************
 */

chrome.runtime.onMessage.addListener((request) => {
    if (request.firstParty_get) {
        firstParty_get = "1";
        firstParty_delete = "u";
        thirdParty_get = "u";
        thirdParty_delete = "u";
        chrome.runtime.sendMessage({
            getMessage : true
        })
    }
    if (request.firstParty_delete) {
        firstParty_get = "u";
        firstParty_delete = "1";
        thirdParty_get = "u";
        thirdParty_delete = "u";
        chrome.runtime.sendMessage({
            getMessage : true
        })
    }
    if (request.thirdParty_get) {
        firstParty_get = "u";
        firstParty_delete = "u";
        thirdParty_get = "1";
        thirdParty_delete = "u";
        chrome.runtime.sendMessage({
            getMessage : true
        })
    }
    if (request.thirdParty_delete) {
        firstParty_get = "u";
        firstParty_delete = "u";
        thirdParty_get = "u";
        thirdParty_delete = "1";
        chrome.runtime.sendMessage({
            getMessage : true
        })
    }
    if (request.refresh) {
        refreshPage();
    }
});

/**************************************************************************************************
*                                   First Time Installation                                       *
* *************************************************************************************************
*/

chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == "install") {
        chrome.tabs.create({
            url: chrome.extension.getURL("skin/welcome.html")
        }, function (tab) {
            console.log("First installation welcome");
        });
    } else if (details.reason == "update") {
        var thisVersion = chrome.runtime.getManifest().version;
        console.log("Updated from " + details.previousVersion + " to " + thisVersion + "!");
    }
});


/****************************************************************************************************
 *                                        copy from storageAPIs.js                                  *
 ****************************************************************************************************
 */

function getDefaultPreference() {
    return new Promise((resolve, reject) =>
        chrome.storage.local.get('defaultPreference', (result) =>
            chrome.runtime.lastError ?
                reject(Error(chrome.runtime.lastError.message)) :
                resolve(result.defaultPreference)
        )
    )
}