"use strict";

export const JSUtils = Object.create(null);

JSUtils.onImageNotFound = function(event) {
    event.srcElement.src = "Media/Images/ImageNotFound.jpeg";
};

JSUtils.deepFreeze = function(object={}) {
    var propNames = Object.getOwnPropertyNames(object);
    if (!propNames.length) return object;

	// Freeze properties before freezing self
	for (const name of propNames) {
        let value = object[name];
        if (value === null) return;
		typeof value === typeof {} ? this.deepFreeze(value) : value;
	}

	return Object.freeze(object);
};

JSUtils.XORDecode = function(encodedString, mask, separator='|') {
	let unmaskedCharCode = 0;
	const inputString = encodedString.split(separator);
	const decoded = [];

	for (let index = 0; index < inputString.length; index++) {
		unmaskedCharCode = parseInt(inputString[index], 16) ^ mask.charCodeAt(index % mask.length);
		decoded.push(String.fromCharCode(unmaskedCharCode));
	}

	return decoded.join('');
};

JSUtils.XOREncode = function(rawString, mask, separator='|') {
	const encoded = [];
	let charCodeMasked;
	let hexedChar;
	
	for (let index = 0; index < rawString.length; index++) {
		charCodeMasked = rawString.charCodeAt(index) ^ mask.charCodeAt(index % mask.length);
		hexedChar = charCodeMasked.toString(16);

		encoded.push(hexedChar);
		encoded.push(separator);
	}

	encoded.pop();
	return encoded.join('');
};

JSUtils.escapeString = function(stringValue) {
	if (stringValue && stringValue.replace)
		return stringValue.replace(/(["'])/g,'\\$1');
};

JSUtils.htmlEscapeString = function(stringValue) {
	return String(stringValue).replace(/'/g, '&apos;').replace(/"/g, '&quot;');
};

JSUtils.htmlUnescapeString = function(stringValue) {
	return String(stringValue).replace(/&apos;/g, "'").replace(/&quot;/g, '"');
};

JSUtils.deepClone = function(object) {
	return JSON.parse(JSON.stringify(object))
};

// NOTE: Is not able to display hours. Anything above 59 minutes will be shown as minutes
JSUtils.getReadableTime = function(time) {
	time = Math.round(time);
	const minutes = (time / 60 > 0 ? parseInt(time / 60) : 0);
	const seconds = (time >= 60 ? time % 60 : time);
	return `${minutes > 9 ? minutes : "0" + minutes}:${seconds > 9 ? seconds : "0" + seconds}`;
};

JSUtils.getReadableBytes = function(bytes) {
	const i = Math.floor(Math.log(bytes) / Math.log(1024)),
	sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	return (bytes / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + sizes[i];
};

// NOTE: Modifies the original array, so make sure you don't pass a frozen/immutable array
JSUtils.shuffleArray = function(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
};

JSUtils.wait = async function(ms) {
	return new Promise((resolve)=> setTimeout(resolve, parseFloat(ms) || 1000));
};

JSUtils.fetchWithTimeout = function(url, timeout, requestOptions=0) {

	return new Promise( (resolve, reject) => {

		const abortController = new AbortController();
		if (typeof requestOptions === typeof {})
			requestOptions.signal = abortController.signal;
		else
			requestOptions = {signal: abortController.signal};

		let timer = setTimeout(
			() => {
				abortController.abort();
				reject( new Error(`Request timed out (${timeout} ms)`) )
			},
			timeout
		);

		fetch(new Request(url, requestOptions)).then(
			response => resolve( response ),
			error => reject( error )
		).finally( () => clearTimeout(timer) );
	})
};

JSUtils.hash = function(inputString) {
	var hash = 0, i, chr;
	if (!inputString.length) return hash;

	for (i = 0; i < inputString.length; i++) {
		chr   = inputString.charCodeAt(i);
		hash  = ((hash << 5) - hash) + chr;
		hash |= 0; // Convert to 32bit integer
	}

	return hash;
};

JSUtils.fetchRequest = async function(
			entryPoint="UNDEFINED_ARGUMENT",
			authKey="UNDEFINED_ARGUMENT",
			controller="UNDEFINED_ARGUMENT",
			functionName="UNDEFINED_ARGUMENT",
			data=Object.create(null)
	) {
	
	const POSTPayload = new FormData();

	POSTPayload.append("authKey", authKey);
	POSTPayload.append("controller", controller)
	POSTPayload.append("function", functionName);
	POSTPayload.append("method", "call");
	POSTPayload.append("parameters", JSON.stringify(data));

	const response = await window.fetch(entryPoint, {
		credentials: "include",
		mode: "same-origin",
		method: "POST",
		headers: {
			"Accept": "application/json"
		},
		body: POSTPayload
	});

	if (response.status !== 200)
		return Object.freeze({ERROR: true, DATA: {MESSAGE: "HTTP-call to AjaxProxy failed for some reason: " + response.statusText,  STATUS: response.status}});
	
	if (!response.json)
		return Object.freeze({ERROR: true, DATA: {MESSAGE: "Return data from the backend entry point could not be parsed as JSON", STATUS: 666}});
	
	const decodedResponse = await response.json();

	if (decodedResponse.RESPONSE_CODE !== 0)
		return Object.freeze({ERROR: true, DATA: {MESSAGE: "HTTP-call to AjaxProxy failed when acting on request data", STATUS: decodedResponse.RESPONSE_CODE}});

	if (decodedResponse.RESPONSE_CODE === 0 && decodedResponse.RESPONSE.STATUS_CODE !== 0)
		return Object.freeze({ERROR: true, DATA: {MESSAGE: "Internal error beyond the proxy", STATUS: decodedResponse.RESPONSE.STATUS_CODE}});

	return Object.freeze({ERROR: false, DATA: decodedResponse.RESPONSE.DATA || null});
};

JSUtils.waitForEvent = function(emitter, eventName, timeout=0) {
    return new Promise((resolve, reject) => {

        let listener = function(data) {
            clearTimeout(timer);
            emitter.removeEventListener(eventName, listener);
            resolve(data);
        }

        emitter.addEventListener(eventName, listener);
        if (timeout < 100) return;

        let timer = setTimeout(() => {
            emitter.removeEventListener(eventName, listener);
            reject(new Error("Timeout waiting for event: " + eventName));
        }, timeout);
    });
};

JSUtils.Log = function(message, type)
{
    const LogMessage = document.createElement("div");

    if (type && type == "WARNING") {
        LogMessage.style.backgroundColor = "orange";
        LogMessage.style.color = "white";
    }
    else if (type && type == "ERROR") {
        LogMessage.style.backgroundColor = "red";
        LogMessage.style.color = "white";
    }

    const now = new Date(Date.now());
    const hours = now.getHours() < 10 ? "0" + now.getHours() : now.getHours();
    const minutes = now.getMinutes() < 10 ? "0" + now.getMinutes() : now.getMinutes();
    const seconds = now.getSeconds() < 10 ? "0" + now.getSeconds() : now.getSeconds();

    LogMessage.innerHTML = `[${hours}:${minutes}:${seconds}:${now.getMilliseconds()}]: ` + (message || "No log message? This is bad cap'n");

    if (LogOutput.children.length >= 20)
        LogOutput.removeChild(LogOutput.children[0]);

    LogOutput.appendChild(LogMessage);
}

Object.freeze(JSUtils);