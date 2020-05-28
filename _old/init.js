"use strict";

/* globals StreamController MediaController view init */

var streamController = Object.create(null);
var mediaController = Object.create(null);

var nextTrack = {};
var semaphore = false;
const APIEntryPoint = "http://asgard/DevTools/Thomas/JSAudioStreamer2/GetAudio.cfm";

const test = function(currentTime) {
    if (semaphore)
        return;

    if (mediaController.getAudioFacade().duration - currentTime > 10)
        return;

    semaphore = true;
    console.warn("SETTING UP NEXT TRACK!");

    nextTrack = new StreamController(
        new AudioObject("The Who - You Better You Bet", 13563686, 339, "audio/mpeg"),
        APIEntryPoint
    );

    nextTrack.start();
};

const test2 = function() {
    console.warn("STARTING NEXT TRACK!");

    mediaController.load(nextTrack);
    mediaController.startPlayback();
};

const init = function() { // eslint-disable-line no-unused-vars

    if (!compatibilityCheck()) {
        document.querySelector("#compatibilityCheck").style.display = "block";
        return;
    }

    document.querySelector("#project").style.display = "block";

    mediaController = new MediaController();

    setupInterfaceEvents();
    view.onMediaControllerInit();

    // mediaController.getAudioFacade().addEventListener("timeupdate", ()=> test(mediaController.getAudioFacade().currentTime));
    // mediaController.getAudioFacade().addEventListener("ended", test2);

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

const getReadableTime = function(time) {
    time = Math.round(time);
    const minutes = (time / 60 > 0 ? parseInt(time / 60) : 0);
    const seconds = (time >= 60 ? time % 60 : time);
    return `${minutes > 9 ? minutes : "0" + minutes}:${seconds > 9 ? seconds : "0" + seconds}`;
};

const shuffleArray = function(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
};

const setupInterfaceEvents = function() {

    document.getElementById("play").addEventListener("click", ()=> mediaController.startPlayback());
    document.getElementById("pause").addEventListener("click", ()=> mediaController.audioController.pause());

    document.getElementById("The Police").addEventListener("click", ()=> {
        let stream = new StreamController(
            new AudioObject("The Police - Roxanne", 3951462, 191, "audio/mpeg"),
            APIEntryPoint
        );
        mediaController.load(stream);
        mediaController.getStream().start();
    });

    document.getElementById("The Who").addEventListener("click", ()=> {
        let stream = new StreamController(
            new AudioObject("The Who - You Better You Bet", 13563686, 339, "audio/mpeg"),
            APIEntryPoint
        );
        mediaController.load(stream);
        mediaController.getStream().start();
    });
    
    document.getElementById("Devin").addEventListener("click", ()=> {
        let stream = new StreamController(
            new AudioObject("Devin Townsend Project - The Mighty Masturbator", 35564574, 988, "audio/mpeg"),
            APIEntryPoint
        );
        mediaController.load(stream);
        mediaController.getStream().start();
    });

    console.log("Interface event handlers set up");
};