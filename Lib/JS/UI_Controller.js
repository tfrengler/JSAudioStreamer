import { JSUtils } from "./Utils.js";

var initializing = true;

export class UI_Controller {

    constructor(serviceLocator) {

        this.services = serviceLocator || null;
        this.elements = Object.create(null);
        this.librarySearchTextThreshold = 3;

        this.selectors = Object.freeze({
            AlbumListTrack: "input[data-trackid]",
            PlaylistCurrentlyPlaying: ".Playing",
            LibrarySelectAllAlbum: "a.SelectAllInAlbum",
            LibraryDeSelectAllAlbum: "a.DeselectAllInAlbum",
            LibraryToggleAlbum: "a.ToggleAlbum",
            LibrarySelectAllArtist: "a.SelectAllInArtist",
            LibraryDeSelectAllArtist: "a.DeselectAllInArtist",
            LibraryToggleArtist: "a.ToggleArtist",
            LibraryArtistSelectedCount: "span.ArtistSelectedCount",
            LibraryAlbumSelectedCount: "span.AlbumSelectedCount",
            LibraryAlbumTrackListContainer: "ol.AlbumTrackList",
            LibraryAlbumListContainer: "section.AlbumList",
            LibraryAlbumContainer: ".Album"
        });

        console.log("UI Controller instantiated" + `${this.services ? ", with services" : ""}`);
        return Object.seal(this);
    }

    init() {

        this.elements.InfoLog                       = document.getElementById("LogOutput");

        // Library
        this.elements.UI_LibraryList                = document.getElementById("LibraryList");
        this.elements.UI_LibrarySearchText          = document.getElementById("LibrarySearchText");
        this.elements.UI_SearchLibrary              = document.getElementById("SearchLibrary");
        this.elements.UI_LibrarySearchOnTitle       = document.getElementById("LibrarySearchOnTitle");
        this.elements.UI_LibrarySearchOnArtist      = document.getElementById("LibrarySearchOnArtist");
        this.elements.UI_LibrarySearchOnAlbum       = document.getElementById("LibrarySearchOnAlbum");
        this.elements.UI_LibrarySearchOnGenre       = document.getElementById("LibrarySearchOnGenre");
        this.elements.UI_ResetLibrary               = document.getElementById("ResetLibrary");
        this.elements.UI_SelectAllInLibrary         = document.getElementById("SelectAllInLibrary");

        // Misc
        this.elements.UI_LibraryControlForm         = document.querySelector("*[name='LibraryControlForm']");
        this.elements.UI_AlbumList                  = document.getElementById("AlbumList");
        this.elements.UI_Playlist                   = document.getElementById("PlaylistBody"); // div
        this.elements.UI_LibraryShowHide            = document.getElementById("LibraryShowHide");

        // Player info
        this.elements.UI_Previous                   = document.getElementById("UI_Previous"); // button
        this.elements.UI_Next                       = document.getElementById("UI_Next"); // button
        this.elements.UI_Retry                      = document.getElementById("UI_Retry"); // button

        // Track Info
        this.elements.UI_TrackID                    = document.getElementById("UI_TrackID"); // td
        this.elements.UI_Title                      = document.getElementById("UI_Title"); // td
        this.elements.UI_Album                      = document.getElementById("UI_Album"); // td
        this.elements.UI_TrackArtists               = document.getElementById("UI_TrackArtists"); // td
        this.elements.UI_Year                       = document.getElementById("UI_Year"); // td
        this.elements.UI_Genres                     = document.getElementById("UI_Genres"); // td
        this.elements.UI_Duration                   = document.getElementById("UI_Duration"); // td
        this.elements.UI_Mimetype                   = document.getElementById("UI_Mimetype"); // td
        this.elements.UI_Size                       = document.getElementById("UI_Size"); // td
        this.elements.UI_ReplayGain                 = document.getElementById("UI_ReplayGain"); // td

        // Playlist
        this.elements.UI_ShowHidePlaylist           = document.getElementById("ShowHidePlayList");
        this.elements.UI_ClearPlaylist              = document.getElementById("ClearPlaylist");
        this.elements.UI_ShufflePlaylist            = document.getElementById("ShufflePlaylist");

        this.elements.UI_Playlist.style.maxHeight   = (window.innerHeight - 100) + "px";
        window.addEventListener("resize", () => this.elements.UI_Playlist.style.maxHeight   = (window.innerHeight - 100) + "px");

        this.elements.UI_LibrarySearchOnTitle.value     = this.services.get("indexes").FILTER.TITLE;
        this.elements.UI_LibrarySearchOnArtist.value    = this.services.get("indexes").FILTER.ARTIST;
        this.elements.UI_LibrarySearchOnAlbum.value     = this.services.get("indexes").FILTER.ALBUM;
        this.elements.UI_LibrarySearchOnGenre.value     = this.services.get("indexes").FILTER.GENRE;

        Object.freeze(this.elements);
        this._initEventHandlers();

        console.log(`UI Controller initialized, with ${Object.keys(this.elements).length} element-handles`);
    }

    _initEventHandlers() {
        let player = this.services.get("player");
        let playlist = this.services.get("playlist");
        let events = this.services.get("events");

        document.querySelector("html").addEventListener("keyup", (event)=> {
            if (event.key !== "Delete") return;

            let selectedPlaylistEntries = document.querySelectorAll("div.Selected");
            if (selectedPlaylistEntries.length) {

                let selectedTrackIDs = Array.from(selectedPlaylistEntries).map((playlistEntry)=> playlistEntry.dataset.trackid);
                this.services.get("playlist").remove(selectedTrackIDs);

                selectedTrackIDs.forEach(trackID => {
                    let trackInputElement = document.querySelector(`li.AlbumEntry > input[data-trackid='${trackID}']`);
                    if (trackInputElement)
                        trackInputElement.checked = false;
                });
                this._updateAllSelectionCounts();
            }
        });

        // Player interaction handlers

        this.elements.UI_Previous.addEventListener("click", ()=> {
            let previousTrack = playlist.getPrevious();
            if (previousTrack)
                player.loadNextTrack(previousTrack, true);
        });

        this.elements.UI_Next.addEventListener("click", ()=> {
            let nextTrack = playlist.getNext();
            if (nextTrack)
                player.loadNextTrack(nextTrack, true);
        });

        this.elements.UI_Retry.addEventListener("click", ()=> {
            player.failedTracks = 0;
            if (player.currentAudioTrack)
                player.loadNextTrack(player.currentAudioTrack.getID(), true);
        });

        events.manager.subscribe(events.types.ERROR, this._onError, this);

        // MEDIA_CONTROLLER
        events.manager.subscribe(events.types.MEDIA_CONTROLLER_LOADING_NEXT_TRACK, function(eventData) {
            JSUtils.Log(this.elements.InfoLog, `Loading next track (${eventData.trackID} | Rotate immediately? ${eventData.rotateImmediately})`);
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_PREPARING_NEXT_TRACK, function() {
            JSUtils.Log(this.elements.InfoLog, "Preparing next track for future playback");
        }, this);

        // events.manager.subscribe(events.types.MEDIA_CONTROLLER_BUFFERING_ENDED, function() {
        //     JSUtils.Log(this.elements.InfoLog, "We think that current track can be played until the end without buffering");
        // }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_BUFFER_UPDATED, function(eventData)
        {
            let Output = [];
            eventData.ranges.forEach(timeRange=> Output.push(`From: ${timeRange.from}, Until: ${timeRange.until}`));

            JSUtils.Log(this.elements.InfoLog, `Audio buffer updated (${Output.join(' | ')})`);
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_PLAYABLE, function() {
            JSUtils.Log(this.elements.InfoLog, "Loaded track is playable");
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_METADATA_LOADED, function() {
            JSUtils.Log(this.elements.InfoLog, "Metadata loaded for current track");
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_ENDED, function(eventData) {
            JSUtils.Log(this.elements.InfoLog, `Playback for current track ended (NEXT: ${eventData.trackID_next ?? "none"})`);

            if (eventData.trackID_next === "END_OF_PLAYABLE_TRACKS") {
                JSUtils.Log(this.elements.InfoLog, "No more tracks (playlist empty)");
            }
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_PLAYING, function() {
            JSUtils.Log(this.elements.InfoLog, "Playback started");
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_PAUSED, function() {
            JSUtils.Log(this.elements.InfoLog, "Playback paused");
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_WAITING, function(){
            JSUtils.Log(this.elements.InfoLog, `Waiting, possibly due to latency or buffering being behind`, "WARNING");
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_STALLED, function(){
            JSUtils.Log(this.elements.InfoLog, `Playback stalled, due to lack of data`, "WARNING");
        }, this);

         events.manager.subscribe(events.types.MEDIA_CONTROLLER_STREAM_URL_UNREACHABLE, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Next track not reachable, retrying in ${eventData.retry / 1000} seconds... (${eventData.streamURL})`, "WARNING");
        }, this);            

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_GAIN_CHANGED, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Gain for loaded track changed (VALUE: ${eventData.value} | DECIBELS: ${eventData.decibels})`);
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_DURATION_CHANGED, function(eventData){
            JSUtils.Log(this.elements.InfoLog, `Duration for current track changed (${eventData.duration})`);
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_STREAM_ABORTED, function(){
            JSUtils.Log(this.elements.InfoLog, "Stream aborted for current track before fully loaded", "WARNING");
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_SEEKING, function(){
            JSUtils.Log(this.elements.InfoLog, "Seeking to new playback mark in stream...");
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_SEEK_ENDED, function(){
            JSUtils.Log(this.elements.InfoLog, "Seeking done");
        }, this);

        events.manager.subscribe(events.types.MEDIA_CONTROLLER_TRACK_ROTATED, this._onTrackRotated, this);

        // Library controls
        this.elements.UI_LibrarySearchText.addEventListener("input", (event)=> {
            if (event.srcElement.value.length >= this.librarySearchTextThreshold && this.elements.UI_SearchLibrary.disabled)
                this.elements.UI_SearchLibrary.disabled = false;
            else if (event.srcElement.value.length < this.librarySearchTextThreshold)
                this.elements.UI_SearchLibrary.disabled = true;
        });

        this.elements.UI_LibrarySearchText.addEventListener("keypress", (event)=> {
            if (event.key === "Enter")
                event.preventDefault();

            if (event.key === "Enter" && event.srcElement.value.length >= this.librarySearchTextThreshold)
                this._searchLibrary();
        });

        this.elements.UI_SearchLibrary.addEventListener("click", this._searchLibrary.bind(this));
        this.elements.UI_LibraryShowHide.addEventListener("change", ()=> {
            document.querySelectorAll(this.selectors.LibraryToggleArtist).forEach(element=> element.click());
        });

        this.elements.UI_ResetLibrary.addEventListener("click", ()=> this.elements.UI_LibraryList.innerHTML = "");
        this.elements.UI_SelectAllInLibrary.addEventListener("click", ()=> this._selectAllTracks(false));

        // Playlist
        this.elements.UI_ShowHidePlaylist.addEventListener("click", event=> {
            if (this.elements.UI_Playlist.style.display === "block") {
                this.elements.UI_Playlist.style.display = "none";
                event.srcElement.classList.remove("fa-eye-slash");
                event.srcElement.classList.add("fa-eye");
            }
            else {
                this.elements.UI_Playlist.style.display = "block";
                event.srcElement.classList.remove("fa-eye");
                event.srcElement.classList.add("fa-eye-slash");
            }
        });

        this.elements.UI_ClearPlaylist.addEventListener("click", ()=> {
            this._selectAllTracks(true);
            Array.from(this.elements.UI_Playlist.children).forEach(element=> element.remove());

            let playlist = this.services.get("playlist");

            if (playlist.count() > 0)
                playlist.clear();
        });

        this.elements.UI_ShufflePlaylist.addEventListener("change", (event)=> {
            this.services.get("playlist").shuffle(event.srcElement.checked);
        });

        events.manager.subscribe(events.types.PLAYLIST_TRACKS_ADDED, this._onTracksAddedToPlaylist.bind(this));
        events.manager.subscribe(events.types.PLAYLIST_TRACKS_REMOVED, this._onTracksRemovedFromPlaylist.bind(this));

        /* Index */
        events.manager.subscribe(events.types.INDEX_MANAGER_INDICES_BUILT, function() {
            this.elements.UI_LibrarySearchText.readOnly = false;
            this.elements.UI_LibrarySearchText.placeholder = "search";
        }, this);

        console.log("UI Controller: event handlers attached");
    }

    // UI handlers
    _onToggleAlbum(element) {
        let AlbumContainer = element.parentElement.parentElement;
        let AlbumList = AlbumContainer.querySelector(this.selectors.LibraryAlbumTrackListContainer);

        if (AlbumList.style.display === "block") {
            AlbumList.style.display = "none";
            element.textContent = "SHOW";
        }
        else {
            AlbumList.style.display = "block";
            element.textContent = "HIDE";
        }
    }

    _onToggleArtist(element) {
        let AlbumContainer = element.parentElement.parentElement;
        let AlbumList = AlbumContainer.querySelector(this.selectors.LibraryAlbumListContainer);

        if (AlbumList.style.display === "block") {
            AlbumList.style.display = "none";
            element.textContent = "SHOW";
        }
        else {
            AlbumList.style.display = "block";
            element.textContent = "HIDE";
        }
    }
    // Removes or adds all tracks across the library depending on the condition. False means all unselected tracks are added, whereas True means all selected tracks are removed
    _selectAllTracks(condition) {
        let TrackIDs = [];

        document.querySelectorAll(`fieldset[data-artistcode]`).forEach(artist=> {
            artist.querySelectorAll(this.selectors.LibraryAlbumContainer).forEach(album=> {
                TrackIDs = TrackIDs.concat(this._onSelectAlbum(artist.dataset.artistcode, album.dataset.albumcode, condition, true));
            })
        });

        if (!TrackIDs.length) return;

        if (condition)
            this.services.get("playlist").remove(TrackIDs);
        else
            this.services.get("playlist").add(TrackIDs);
    }

    _onSelectArtist(artistCode, condition) {
        let TrackIDs = [];

        document.querySelector(`fieldset[data-artistcode='${artistCode}']`).querySelectorAll(this.selectors.LibraryAlbumContainer).forEach(album=> {
            TrackIDs = TrackIDs.concat(this._onSelectAlbum(artistCode, album.dataset.albumcode, condition, true));
        });

        if (!TrackIDs.length) return;

        if (condition)
            this.services.get("playlist").remove(TrackIDs);
        else
            this.services.get("playlist").add(TrackIDs);
    }

    _onSelectAlbum(artistCode, albumCode, condition, returnTracksOnly) {

        let AlbumTrackList = document.querySelector(`fieldset[data-albumcode='${albumCode}']`).querySelector(this.selectors.LibraryAlbumTrackListContainer);
        let TrackIDs = [];

        let ChildElements = Array.from(AlbumTrackList.children);
        ChildElements.forEach(element=> {
            if (element.children[0].checked !== condition) return;

            element.children[0].checked = !condition;
            if (element.children[0].dataset.trackid)
                TrackIDs.push(element.children[0].dataset.trackid);
        });

        if (!TrackIDs.length) return TrackIDs;

        if (condition) {
            this._updateSelectionCounts(artistCode, albumCode, -TrackIDs.length);

            if (returnTracksOnly)
                return TrackIDs;

            this.services.get("playlist").remove(TrackIDs);
        }
        else {
            this._updateSelectionCounts(artistCode, albumCode, TrackIDs.length);

            if (returnTracksOnly)
                return TrackIDs;

            this.services.get("playlist").add(TrackIDs);
        }
    }

    _onSelectTrack(artistCode, albumCode, trackID, selected) {
        let Playlist = this.services.get("playlist");

        if (selected) {
            if (trackID) Playlist.add([trackID]);
            this._updateSelectionCounts(artistCode, albumCode, 1);
        }
        else {
            if (trackID) Playlist.remove([trackID]);
            this._updateSelectionCounts(artistCode, albumCode, -1);
        }
    }

    _updateSelectionCounts(artistCode, albumCode, newCount) {
        let ArtistSelectedCount = document.querySelector(`fieldset[data-artistcode='${artistCode}']`).querySelector(this.selectors.LibraryArtistSelectedCount);
        let AlbumSelectedCount = document.querySelector(`fieldset[data-albumcode='${albumCode}']`).querySelector(this.selectors.LibraryAlbumSelectedCount);

        ArtistSelectedCount.textContent = parseInt(ArtistSelectedCount.textContent) + newCount;
        AlbumSelectedCount.textContent = parseInt(AlbumSelectedCount.textContent) + newCount;
    }

    _updateAllSelectionCounts() {
        let start = performance.now();
        // Wipe all existing counts, setting them to zero, otherwise we risk adding the same count of selected tracks to the already existing count (see _updateSelectionCounts)
        document.querySelectorAll(".AlbumSelectedCount").forEach(selectionCountSpan=> selectionCountSpan.textContent = "0");
        document.querySelectorAll(".ArtistSelectedCount").forEach(selectionCountSpan=> selectionCountSpan.textContent = "0");

        document.querySelectorAll(this.selectors.LibraryAlbumContainer).forEach(albumContainer=> {
            let selectedTracks = albumContainer.querySelectorAll(`${this.selectors.LibraryAlbumListContainer} input:checked`);
            if (selectedTracks.length > 0)
                this._updateSelectionCounts(selectedTracks[0].dataset.artistcode, albumContainer.dataset.albumcode, selectedTracks.length);
        });

        if (window.DevMode) console.warn(`_updateAllSelectionCounts took ${(performance.now() - start).toFixed(2)} ms`);
    }

    _onTracksAddedToPlaylist(eventData) {
        let playlistIndex = this.elements.UI_Playlist.children.length + 1;

        eventData.added.forEach(trackID=> {
            let playlistEntry = document.createElement("div");
            let trackData = this.services.get("indexes").getTrackData(trackID);

            if (!trackData) {
                this._onError(new Error("_onTracksAddedToPlaylist: No track data for ID: " + trackID || "undefined"));
                return;
            }

            playlistEntry.innerHTML = `<span class="PlaylistEntryCounter">${playlistIndex < 10 ? "0" + playlistIndex : playlistIndex}</span> | ${trackData.TrackArtists.length > 30 ? trackData.TrackArtists.slice(0,30) + "..." : trackData.TrackArtists} - ${trackData.Title.length > 30 ? trackData.Title.slice(0,30) + "..." : trackData.Title} | ${JSUtils.getReadableTime(trackData.Duration)}`;
            playlistEntry.title = trackData.Title;
            playlistEntry.dataset.trackid = trackID;
            playlistEntry.classList.add("PlaylistEntry");

            playlistEntry.addEventListener("click", (event)=> {
                if (event.target.classList.contains("Selected"))
                    event.target.classList.remove("Selected");
                else
                    event.target.classList.add("Selected");
            });

            playlistEntry.addEventListener("dblclick", (event)=> {
                let currentlyPlaying = document.querySelector(this.selectors.PlaylistCurrentlyPlaying);
                if (currentlyPlaying) currentlyPlaying.classList.remove("Playing");

                this.services.get("playlist").setCurrent(event.target.dataset.trackid);
                this.services.get("player").loadNextTrack(event.target.dataset.trackid, true);
                event.target.classList.add("Playing");
            });

            this.elements.UI_Playlist.appendChild(playlistEntry);
            playlistIndex++;
        });

        if (!initializing) return;

        if (localStorage.getItem("currentTrack")) {
            let playlistEntry = document.querySelector(`.PlaylistEntry[data-trackid='${localStorage.getItem("currentTrack")}']`);
            if (playlistEntry) playlistEntry.classList.add("Selected");
            initializing = false;
        }
    }

    _onTracksRemovedFromPlaylist(eventData) {
        eventData.removed.forEach(trackID=> {
            let playlistEntry = document.querySelector(`div.PlaylistEntry[data-trackid='${trackID}']`);
            if (playlistEntry) playlistEntry.remove();
        });

        let counter = 1;

        document.querySelectorAll(".PlaylistEntryCounter").forEach(counterElement=> {
            counterElement.textContent = counter < 10 ? "0" + counter : counter;
            counter++;
        });
    }

    _resetPlayerUI() {

        this.elements.UI_PlayCursor.textContent               = "00:00";
        this.elements.UI_Player_Duration.textContent          = "00:00 | 0";
        this.elements.UI_Buffered_Until.textContent           = "00:00";
        this.elements.UI_Buffer_Tail.textContent              = "00:00";
        this.elements.UI_Audio_Buffer.value                   = 0;
        this.elements.UI_Datastream_Progress.max              = 0;
        this.elements.UI_Datastream_Progress.value            = 0;
        this.elements.UI_Datastream_BytesRead.textContent     = "0";
        this.elements.UI_Datastream_BytesExpected.textContent = "0";
        this.elements.UI_AudioObject_State.textContent        = "N/A";
        this.elements.UI_Datastream_State.textContent         = "N/A";
    }

    _resetTrackInfoUI(data={}) {
        if (!data) data = {};

        // TrackID is a separate key which isn't included in the data-param
        // this.elements.UI_TrackID.textContent        = data.trackID || "N/A";
        this.elements.UI_Title.textContent          = data.Title || "N/A";
        this.elements.UI_Album.textContent          = data.Album || "N/A";
        this.elements.UI_TrackArtists.textContent   = data.TrackArtists || "N/A";
        this.elements.UI_Year.textContent           = data.Year || "N/A";
        this.elements.UI_Genres.textContent         = data.Genres || "N/A";
        this.elements.UI_Duration.textContent       = data.Duration || "N/A";
        this.elements.UI_Mimetype.textContent       = data.Mimetype || "N/A";
        this.elements.UI_Size.textContent           = data.Size ? data.Size + " bytes" + " | " + JSUtils.getReadableBytes(data.Size) : "0 bytes";
        this.elements.UI_ReplayGain.textContent     = data.ReplayGainTrack || "N/A";
    }

    _searchLibrary() {
        this.elements.UI_LibraryShowHide.checked = true;

        let filter =      (this.elements.UI_LibrarySearchOnAlbum.checked === true ? parseInt(this.elements.UI_LibrarySearchOnAlbum.value)  : 0)
                        | (this.elements.UI_LibrarySearchOnTitle.checked === true ? parseInt(this.elements.UI_LibrarySearchOnTitle.value) : 0)
                        | (this.elements.UI_LibrarySearchOnArtist.checked === true ? parseInt(this.elements.UI_LibrarySearchOnArtist.value) : 0)
                        | (this.elements.UI_LibrarySearchOnGenre.checked === true ? parseInt(this.elements.UI_LibrarySearchOnGenre.value) : 0);

        if (filter === 0) return;

        let searchString = this.elements.UI_LibrarySearchText.value;
        this._createLibraryList( this.services.get("indexes").getCollection(filter, searchString) );
    }

    _createLibraryList(manifest) {

        if (!Object.keys(manifest).length) {
            this.elements.UI_LibraryList.innerHTML = "<h1>Nothing found</h1>";
            return;
        }

        this.elements.UI_SearchLibrary.disabled = true;
        this.elements.UI_LibraryList.innerHTML = "<h1>Loading...</h1>";

        let output = [];
        let masterTrackIndex = this.services.get("indexes").MasterAudioTrackIndex;
        let playlistEntries = this.services.get("playlist").getAll();

        let start_output = performance.now();

        for (let albumArtistName in manifest) {
            let artistcode = JSUtils.hash(albumArtistName);

            output.push(`<fieldset data-artistcode="${artistcode}" class="ArtistCollection" >
                <legend class="Artist">${albumArtistName} - (<span class="ArtistSelectedCount" >0</span>)</legend>

                <div class="ArtistControls" >
                    <a href="javascript:;" class="ToggleArtist" >HIDE</a>
                    <span>&nbsp;|&nbsp;</span>
                    <a href="javascript:;" data-artistcode="${artistcode}" class="SelectAllInArtist" >ALL</a>
                    <span>&nbsp;|&nbsp;</span>
                    <a href="javascript:;" data-artistcode="${artistcode}" class="DeselectAllInArtist" >NONE</a>
                </div>

                <section class="AlbumList" style="display: block;" >
                    ${Object.keys(manifest[albumArtistName]).map(albumName=> {
                        var albumcode = JSUtils.hash(albumName);

                        return `<fieldset data-albumcode="${albumcode}" class="Album">
                            <legend class="AlbumName">${albumName} - (<span class="AlbumSelectedCount" >0</span>)</legend>

                            <div class="AlbumControls">
                                <a href="javascript:;" class="ToggleAlbum" >HIDE</a>
                                <span>&nbsp;|&nbsp;</span>
                                <a href="javascript:;" data-artistcode="${artistcode}" data-albumcode="${albumcode}" class="SelectAllInAlbum" >ALL</a>
                                <span>&nbsp;|&nbsp;</span>
                                <a href="javascript:;" data-artistcode="${artistcode}" data-albumcode="${albumcode}" class="DeselectAllInAlbum" >NONE</a>
                            </div>

                            <ol class="AlbumTrackList" style="display: block;" >
                                ${manifest[albumArtistName][albumName].map(trackID=> {
                                    let trackData = masterTrackIndex[trackID];

                                    return `<li class="AlbumEntry" >
                                        <input id="${JSUtils.hash(trackID)}" data-albumcode="${albumcode}" data-artistcode="${artistcode}" data-trackid="${trackID}" ${playlistEntries.includes(trackID) ? "checked" : ""} type="checkbox">
                                        <label for="${JSUtils.hash(trackID)}" class="AudioTrack">${trackData.TrackArtists} - ${trackData.Title}</label>
                                    </li>`
                                }).join("")}
                            </ol>
                        </fieldset>`
                    }).join("")}
                </section>
            </fieldset>`);
        }

        this.elements.UI_LibraryList.innerHTML = output.join("");
        if (window.DevMode) console.warn(`_createLibraryList: Output took ${(performance.now() - start_output).toFixed(2)} ms`);

        let start_events = performance.now();

        document.querySelectorAll(this.selectors.AlbumListTrack).forEach(
            spanElement=> spanElement.addEventListener("click", (event)=> this._onSelectTrack(
                event.target.dataset.artistcode,
                event.target.dataset.albumcode,
                event.target.dataset.trackid,
                event.target.checked
            ))
        );

        document.querySelectorAll(this.selectors.LibrarySelectAllAlbum).forEach(element=> element.addEventListener("click", (event)=> this._onSelectAlbum(event.target.dataset.artistcode, event.srcElement.dataset.albumcode, false, false)));
        document.querySelectorAll(this.selectors.LibraryDeSelectAllAlbum).forEach(element=> element.addEventListener("click", (event)=> this._onSelectAlbum(event.target.dataset.artistcode, event.srcElement.dataset.albumcode, true, false)));
        document.querySelectorAll(this.selectors.LibraryToggleAlbum).forEach(element=> element.addEventListener("click", (event)=> this._onToggleAlbum(event.target)));

        document.querySelectorAll(this.selectors.LibrarySelectAllArtist).forEach(element=> element.addEventListener("click", (event)=> this._onSelectArtist(event.target.dataset.artistcode, false)));
        document.querySelectorAll(this.selectors.LibraryDeSelectAllArtist).forEach(element=> element.addEventListener("click", (event)=> this._onSelectArtist(event.target.dataset.artistcode, true)));
        document.querySelectorAll(this.selectors.LibraryToggleArtist).forEach(element=> element.addEventListener("click", (event)=> this._onToggleArtist(event.target)));

        if (this.elements.UI_LibrarySearchText.value.length >= this.librarySearchTextThreshold)
            this.elements.UI_SearchLibrary.disabled = false;

        if (window.DevMode) console.warn(`_createLibraryList: Attaching event handlers took ${(performance.now() - start_events).toFixed(2)} ms`);
        this._updateAllSelectionCounts();
    }

    _onError(error) {
        if (error instanceof Error) {
            JSUtils.Log(this.elements.InfoLog, error.message, "ERROR");
            console.error(error);
            return;
        }

        let errorOutput;
        if (error === null) {
            errorOutput = "null";
            console.trace();
        }
        else if (error === undefined) {
            errorOutput = "undefined";
            console.trace();
        }
        else
            errorOutput = error.constructor.name;

        JSUtils.Log(this.elements.InfoLog, "Error-param is not an instance of Error: " + errorOutput, "WARNING");
    }

    _onTrackRotated(eventData) {
        JSUtils.Log(this.elements.InfoLog, `Rotated next and current audio tracks (next: ${eventData.trackID})`);

        this._resetTrackInfoUI(eventData.trackData);

        let currentlyPlaying = document.querySelector(this.selectors.PlaylistCurrentlyPlaying);
        if (currentlyPlaying) currentlyPlaying.classList.remove("Playing");
        document.querySelector(`.PlaylistEntry[data-trackid='${eventData.trackID}']`).classList.add("Playing");
    }
}