"use strict";

/* globals streamController mediaController readableBytes */

const view = Object.create(null);

view.onInternalBufferUpdate = function() {

    document.querySelector("#streamBuffer").value = streamController.stream.status.getBufferedPercentage();
    document.querySelector("#streamBufferPercentage").innerText = streamController.stream.status.getBufferedPercentage().toFixed(2) + "%";
    document.querySelector("#streamBytesBuffered").innerText = streamController.stream.status.getBufferedBytes();
    document.querySelector("#streamDataChunks").innerText = `${streamController.stream.CHUNKS.length} out of ${streamController.stream.CHUNKS_EXPECTED}`;
};

view.onNewStreamLoaded = function() {

    document.querySelector("#streamContentSize").innerText = `${streamController.stream.SIZE} bytes || ${readableBytes(streamController.stream.SIZE)}`;
    document.querySelector("#duration").innerText = streamController.stream.METADATA.length + " seconds";
    document.querySelector("#currentTime").innerText = "0";
    document.querySelector("#streamBytesPerSecond").innerText = Math.round(streamController.stream.BYTES_PER_SECOND);

    document.querySelector("#title").innerText = streamController.stream.METADATA.title;
    document.querySelector("#artist").innerText = streamController.stream.METADATA.artist;
    document.querySelector("#album").innerText = streamController.stream.METADATA.album;
    document.querySelector("#genre").innerText = streamController.stream.METADATA.genre;
    document.querySelector("#year").innerText = streamController.stream.METADATA.year;
};

view.onMediaBufferUpdate = function() {

    document.querySelector("#mediaBuffer").value = mediaController.status.bufferedBytes;
    document.querySelector("#secondsBuffered").innerText = Math.round(mediaController.status.bufferedDuration);
    document.querySelector("#bytesBuffered").innerText = Math.round(mediaController.status.bufferedBytes) + " bytes";
    document.querySelector("#secondsBufferedUntil").innerText = Math.round(mediaController.status.bufferedUntil);
    document.querySelector("#mediaChunks").innerText = `${mediaController.status.nextDataChunk} out of ${mediaController.status.dataChunksExpected}`;
};

view.onMediaBufferReset = function() {

    document.querySelector("#mediaChunks").innerText = "0 out of 0";
    document.querySelector("#mediaBuffer").value = 0;
    document.querySelector("#secondsBuffered").innerText = "0";
    document.querySelector("#bytesBuffered").innerText = "0";
    document.querySelector("#secondsBufferedUntil").innerText = "0";

};

view.onPlaybackTimeChanged = function() {
    document.getElementById("currentTime").innerText = Math.round(mediaController.AUDIO_FACADE.currentTime);
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
    document.querySelector("#streamState").innerText = streamController.state.description;
};

view.onMediaBufferStrategyKnown = function() {
    document.querySelector("#mediaBufferStrategy").innerText = mediaController.status.bufferStrategy.description;
};

view.onMediaMimetypeKnown = function(mimeType) {
    document.querySelector("#mediaBufferMimetype").innerText = mimeType;
};