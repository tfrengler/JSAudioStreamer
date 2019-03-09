"use strict";

var streamController = Object.create(null);
var mediaController = Object.create(null);

const init = function() {

    streamController = new StreamController();
    mediaController = new MediaController();

    setupInterfaceEvents();
    view.onMediaControllerInit();

    console.log("Init done, ready to rock!");
};

const wait = function(ms) {
    return new Promise((resolve, reject)=> setTimeout(resolve, parseFloat(ms) || 0));
};

const readableBytes = function(bytes) {
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