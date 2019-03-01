"use strict";

const view = Object.create(null);

view.onInternalBufferUpdate = function() {

    document.querySelector("#streamBuffer").value = streamController.stream.status.getBufferedPercentage();
    document.querySelector("#streamBufferPercentage").innerText = streamController.stream.status.getBufferedPercentage().toFixed(2) + "%";
    document.querySelector("#streamBytesBuffered").innerText = streamController.stream.status.getBufferedBytes();
    
};

view.onAudioStreamSizeUpdate = function() {
    document.querySelector("#streamContentSize").innerText = streamController.stream.SIZE;
};