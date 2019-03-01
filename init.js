"use strict";

var streamController = Object.create(null);
var mediaController = Object.create(null);

const init = function() {

    streamController = new StreamController();
    // streamController.load("The Police - Roxanne");

    setupInterfaceEvents();

    console.log("Init done, ready to rock!");
};

const setupInterfaceEvents = function() {

    // document.getElementById("play").addEventListener("click", );
    // document.getElementById("pause").addEventListener("click", );

    document.querySelectorAll(".audioTrack").forEach((value)=> {
        value.addEventListener("click", function() {streamController.load(this.dataset.trackid)});
    });

    console.log("Interface event handlers set up");
};