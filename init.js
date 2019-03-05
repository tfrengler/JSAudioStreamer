"use strict";

var streamController = Object.create(null);
var mediaController = Object.create(null);

const init = function() {

    streamController = new StreamController();
    mediaController = new MediaController();

    setupInterfaceEvents();

    console.log("Init done, ready to rock!");
};

const wait = function(ms) {
    return new Promise((resolve, reject)=> setTimeout(resolve, parseFloat(ms) || 0));
};

const setupInterfaceEvents = function() {

    document.getElementById("play").addEventListener("click", ()=> mediaController.play());
    document.getElementById("pause").addEventListener("click", ()=> mediaController.stop());

    document.querySelectorAll(".audioTrack").forEach((value)=> {
        value.addEventListener("click", function() {streamController.load(this.dataset.trackid)});
    });

    console.log("Interface event handlers set up");
};