"use strict";

/* globals streamController mediaController readableBytes */

const view = Object.create(null);

view.onInternalBufferUpdate = function() {

    document.querySelector("#streamBuffer").value = mediaController.getStream().getStreamObject().getStoredPercentage();
    document.querySelector("#streamBufferPercentage").innerText = mediaController.getStream().getStreamObject().getStoredPercentage() + "%";
    document.querySelector("#streamBytesBuffered").innerText = `${mediaController.getStream().getStreamObject().getStoredBytes()} bytes || ${readableBytes(mediaController.getStream().getStreamObject().getStoredBytes())}`;
    document.querySelector("#streamDataChunks").innerText = mediaController.getStream().getStreamObject().getFragmentCount();
};

view.onNewStreamLoaded = function() {

    document.querySelector("#streamBuffer").value = 0;
    document.querySelector("#streamContentSize").innerText = `${mediaController.getStream().getStreamObject().SIZE} bytes || ${readableBytes(mediaController.getStream().getStreamObject().SIZE)}`;
    document.querySelector("#duration").innerText = mediaController.getStream().getStreamObject().DURATION + " seconds";
    document.querySelector("#currentTime").innerText = "0";
    document.querySelector("#streamBytesPerSecond").innerText = Math.round(mediaController.getStream().getStreamObject().BYTES_PER_SECOND);

    document.querySelector("#title").innerText = mediaController.getStream().getStreamObject().ID;
};

view.onMediaBufferUpdate = function() {

    document.querySelector("#mediaBuffer").value = mediaController.status.bufferedBytes;
    document.querySelector("#secondsBuffered").innerText = Math.round(mediaController.status.bufferedDuration);
    document.querySelector("#bytesBuffered").innerText = Math.round(mediaController.status.bufferedBytes) + " bytes";
    document.querySelector("#secondsBufferedUntil").innerText = `${Math.round(mediaController.status.bufferedUntil)} || ${getReadableTime(mediaController.status.bufferedUntil)}`;
    document.querySelector("#mediaChunks").innerText = `${mediaController.status.nextDataChunk}`;
};

view.onMediaBufferReset = function() {

    document.querySelector("#mediaChunks").innerText = "0";
    document.querySelector("#mediaBuffer").value = 0;
    document.querySelector("#secondsBuffered").innerText = "0";
    document.querySelector("#bytesBuffered").innerText = "0";
    document.querySelector("#secondsBufferedUntil").innerText = "0";

};

view.onPlaybackTimeChanged = function() {
    document.getElementById("currentTime").innerText = Math.round(mediaController.audioController.currentTime);
};

view.onMediaControllerInit = function() {

    document.querySelector("#mediaBufferSize").innerText = `${mediaController.BUFFER_MAX_SIZE} bytes || ${readableBytes(mediaController.BUFFER_MAX_SIZE)}`;
    document.querySelector("#mediaBuffer").max = mediaController.BUFFER_MAX_SIZE;
    document.querySelector("#mediaBuffer").high = (mediaController.BUFFER_MAX_SIZE / 100) * 70;
};

view.onMediaStateChange = function() {
    document.querySelector("#mediaState").innerText = mediaController.status.state.description;
};

view.onStreamStateChange = function() {
    document.querySelector("#streamState").innerText = mediaController.getStream().state.description;
};

view.onMediaBufferStrategyKnown = function() {
    document.querySelector("#mediaBufferStrategy").innerText = mediaController.status.bufferStrategy.description;
};

view.onMediaMimetypeKnown = function(mimeType) {
    document.querySelector("#mediaBufferMimetype").innerText = mimeType;
};