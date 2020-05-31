/*
    To get audio working via streaming:
    - Create an Audio-element
    - Create a MediaSource
    - Create SourceBuffer from MediaSource instance
    - Create object url from MediaSource instance
    - Set object url either on Audio-element OR
    - Create Source-element, set object url on it and then append to Audio-element
    - Call load() on Audio-element to rescan sources and select one available
*/
class MediaController {

    /*
        Audio-element
        MediaSource-element
        SourceBuffer-element
        AudioTrackStream-instance

        var Source;
        var BufferSource;
        var PlayCursorLastUpdated = 0;
        var UpdatingBuffer = false;
        var LastTail = 0;
        var BufferError = false;
        var ResumeWhenPlayable = false;
        var DesiredBufferHead = 120;
        var BufferAheadTriggerTreshold = 30;
        var UnreachableSourcesLimit = 3;
        var UnreachableSources = 0;
        var CurrentlyPlayingTrack;
        var StalledInitialRecoveryTimeout;
        var StalledRetryInterval = 3000;
        var StalledRetryMaxTimes = 3;
        var StalledRecoverAttempts = 0;
        var StalledInitialRecoveryAttempt;
        var Stalled;

        const CHROME_SOURCEBUFFER_LIMIT = 12582912;
        const FIREFOX_SOURCEBUFFER_LIMIT = 15728640;
        const EDGE_SOURCEBUFFER_LIMIT = 12582912;
    */
    
    constructor() {
        // Properties
        this.audioPlayer = new Audio();
        this.audioPlayer.autoplay = false;
        this.audioPlayer.preload = "metadata";
    
        // Event handlers
        this.audioPlayer.addEventListener("loadedmetadata", ()=> JSUtils.Log(`Metadata loaded (${BytesRead} bytes)`));
        this.audioPlayer.addEventListener("waiting", ()=> JSUtils.Log("Playback stopped - lack of data from source. This may be temporary (latency, seeking)", "WARNING"));
        this.audioPlayer.addEventListener("stalled", ()=> {
            JSUtils.Log("Streaming data from media source has stalled", "ERROR");
            Stalled = true;
            StalledInitialRecoveryAttempt = setTimeout(recoverFromStall, 10000);
        });

        this.audioPlayer.addEventListener("ended", ()=> {
            JSUtils.Log(`Playback ended, releasing data source and removing source-element (${this.audioPlayer.currentSrc} | ${this.audioPlayer.children[0].dataset.trackid})`);
            
            URL.revokeObjectURL(this.audioPlayer.currentSrc);
            this.audioPlayer.children[0].src = "";
            this.audioPlayer.removeChild(this.audioPlayer.children[0]);

            let playingElement;
            let nextTrack = getNextTrack();

            if (playingElement = document.querySelector(".playing"))
                playingElement.classList.remove("playing");

            if (nextTrack)
                prepareAndLoadMedia(nextTrack.dataset["src"], nextTrack, true);
        });

        this.audioPlayer.addEventListener("canplay", ()=> {
            JSUtils.Log("Enough audio frames to start playback");
            
            if (Stalled && StalledInitialRecoveryAttempt > 0) {
                clearTimeout(StalledInitialRecoveryAttempt);
                StalledInitialRecoveryAttempt = 0;
            };
            Stalled = false;

            if (ResumeWhenPlayable) this.audioPlayer.play().then(()=> {
                JSUtils.Log("Playback auto-started");
                CurrentlyPlayingTrack.classList.add("playing");
            });
        });

        this.audioPlayer.addEventListener("error", ()=> {
            if (this.audioPlayer.error.name === "QuotaExceededError")
                JSUtils.Log("SourceBuffer overflowed at " + BytesRead + " bytes", "ERROR");

            JSUtils.Log(this.audioPlayer.error, "ERROR");
            // Perhaps consider a way to ensure that the 2 minutes of data we buffer ahead doesn't overflow the buffer? Unlikely, but still
        });

        this.audioPlayer.addEventListener("durationchange", ()=> {
            if (this.audioPlayer.duration === Infinity) return;
            JSUtils.Log("Duration known");
            UI_Duration.innerText = Math.round(this.audioPlayer.duration) + " seconds | " + JSUtils.getReadableTime(this.audioPlayer.duration);
        });

        this.audioPlayer.addEventListener("timeupdate", ()=> {
            if ((performance.now() - PlayCursorLastUpdated) < 900)
                return;

            UI_PlayCursor.innerText = JSUtils.getReadableTime(this.audioPlayer.currentTime);
            PlayCursorLastUpdated = performance.now();

            // if ((this.audioPlayer.duration - this.audioPlayer.currentTime || 999) <= 5 && !PreparingNextTrack)
            // Prepare next song, and preload data

            if (UpdatingBuffer || StreamClosed) return;
            if (this.audioPlayer.buffered.end(0) - this.audioPlayer.currentTime < 30) {
                JSUtils.Log(`Less than ${BufferAheadTriggerTreshold} seconds of audio data ahead of play cursor, buffering...`);
                bufferAhead();
            }
        });
    };

}

export {MediaController};