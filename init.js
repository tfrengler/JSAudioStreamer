"use strict";

/* globals StreamController MediaController view init */

var streamController = Object.create(null);
var mediaController = Object.create(null);

const init = function() { // eslint-disable-line no-unused-vars

    if (!compatibilityCheck()) {
        document.querySelector("#compatibilityCheck").style.display = "block";
        return;
    }

    document.querySelector("#project").style.display = "block";

    streamController = new StreamController();
    mediaController = new MediaController();

    setupInterfaceEvents();
    view.onMediaControllerInit();

    console.log("Init done, ready to rock!");
};

const compatibilityCheck = function() {

    var passed = true;

    if (window.HTMLAudioElement)
        document.querySelector("#compatHTMLAudioElement").innerHTML = "<b style='background-color:green;color:white'>YES</b>";
    else {
        document.querySelector("#compatHTMLAudioElement").innerHTML = "<b style='background-color:red;color:white'>NO</b>";
        passed = false;
    }

    if (window.MediaSource)
        document.querySelector("#compatMediaSource").innerHTML = "<b style='background-color:green;color:white'>YES</b>";
    else {
        document.querySelector("#compatMediaSource").innerHTML = "<b style='background-color:red;color:white'>NO</b>";
        passed = false;
    }

    if (window.SourceBuffer)
        document.querySelector("#compatSourceBuffer").innerHTML = "<b style='background-color:green;color:white'>YES</b>";
    else {
        document.querySelector("#compatSourceBuffer").innerHTML = "<b style='background-color:red;color:white'>NO</b>";
        passed = false;
    }

    if (window.MediaSource && MediaSource.isTypeSupported("audio/mpeg"))
        document.querySelector("#compatSourceBufferAudio").innerHTML = "<b style='background-color:green;color:white'>YES</b>";
    else {
        document.querySelector("#compatSourceBufferAudio").innerHTML = "<b style='background-color:red;color:white'>NO</b>";
        passed = false;
    }

    if (passed)
        return true;

    return false;
};

const wait = function(ms) { // eslint-disable-line no-unused-vars
    return new Promise((resolve)=> setTimeout(resolve, parseFloat(ms) || 0));
};

const readableBytes = function(bytes) { // eslint-disable-line no-unused-vars
    var i = Math.floor(Math.log(bytes) / Math.log(1024)),
    sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    return (bytes / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + sizes[i];
};

const setupInterfaceEvents = function() {

    document.getElementById("play").addEventListener("click", ()=> mediaController.play());
    document.getElementById("pause").addEventListener("click", ()=> mediaController.stop());

    document.querySelectorAll(".audioTrack").forEach((value)=> {
        value.addEventListener("click", function() {streamController.load(this.dataset.trackid)});
    });

    console.log("Interface event handlers set up");
};