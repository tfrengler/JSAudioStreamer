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

    mediaController = new MediaController(new StreamController("GetAudio.cfm"));

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

    document.getElementById("play").addEventListener("click", ()=> mediaController.startPlayback());
    document.getElementById("pause").addEventListener("click", ()=> mediaController.audioController.pause());

    document.getElementById("The Police").addEventListener("click", ()=> 
        mediaController.load( new AudioObject("The Police - Roxanne", 3951462, 191, "audio/mpeg") )
    );

    document.getElementById("The Who").addEventListener("click", ()=> 
        mediaController.load( new AudioObject("The Who - You Better You Bet", 13563686, 339, "audio/mpeg") )
    );
    
    document.getElementById("Devin").addEventListener("click", ()=> 
        mediaController.load( new AudioObject("Devin Townsend Project - The Mighty Masturbator", 35564574, 988, "audio/mpeg") )
    );

    console.log("Interface event handlers set up");
};