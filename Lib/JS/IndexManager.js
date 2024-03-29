import { JSUtils } from "./Utils.js";

export class IndexManager {

    constructor(entryPoint, serviceLocator) {
        this.events = serviceLocator.get("events") || Object.freeze({manager: {trigger() {console.warn("INDEX MANAGER EVENTS: No event service provided")}}, types: {}});
        this.entryPoint = entryPoint;
        this.MasterAudioTrackIndex = null;

        this.FILTER = Object.freeze({
            "TITLE": 1,
            "ALBUM": 2,
            "ARTIST": 4,
            "GENRE": 8,
            // Reverse lookup
            1: "TITLE",
            2: "ALBUM",
            4: "ARTIST",
            8: "GENRE"
        });
        
        this.Indexes = Object.freeze({
            TRACKS_BY_ALBUM: {},
            TRACKS_BY_ALBUM_ARTIST: {},
            TRACKS_BY_TRACK_ARTIST: {},
            TRACKS_BY_GENRE: {},
            ALBUMS_PER_ALBUM_ARTIST: {}
        });

        return Object.seal(this);
    }

    load() {
        return new Promise((resolve, reject)=> {
            var ClientIndex;
    
            fetch(this.entryPoint + "/ClientIndex.json", {cache: "no-store", mode: "same-origin", method: "GET", redirect: "error", headers: {"Accept": "application/json"}})
            .then(response=> response.json())
            .then(jsonResponse=> {
                
                ClientIndex = jsonResponse;
                this._buildIndexes(ClientIndex);
                resolve();
            })
            .catch(error=> reject(error));
        })
    }

    _buildIndexes(clientIndex) {
        this.MasterAudioTrackIndex = JSUtils.deepFreeze(clientIndex);

        console.log(`IndexManager: Client index loaded (${Object.keys(this.MasterAudioTrackIndex).length} tracks)`);

        for (let trackID in this.MasterAudioTrackIndex) {
            let currentTrack = this.MasterAudioTrackIndex[trackID];
            
            let TrackArtists = currentTrack.TrackArtists || "_UNKNOWN_";
            let AlbumArtists = currentTrack.AlbumArtists || "_UNKNOWN_";
            let Album = currentTrack.Album || "_UNKNOWN_";
            let Genres = currentTrack.Genres || "_UNKNOWN_";
    
            if (this.Indexes.TRACKS_BY_ALBUM[Album]) 
                this.Indexes.TRACKS_BY_ALBUM[Album].push(trackID);
            else
                this.Indexes.TRACKS_BY_ALBUM[Album] = [trackID];
    
            if (this.Indexes.TRACKS_BY_TRACK_ARTIST[TrackArtists]) 
                this.Indexes.TRACKS_BY_TRACK_ARTIST[TrackArtists].push(trackID);
            else
                this.Indexes.TRACKS_BY_TRACK_ARTIST[TrackArtists] = [trackID];
    
            if (this.Indexes.TRACKS_BY_ALBUM_ARTIST[AlbumArtists]) 
                this.Indexes.TRACKS_BY_ALBUM_ARTIST[AlbumArtists].push(trackID);
            else
                this.Indexes.TRACKS_BY_ALBUM_ARTIST[AlbumArtists] = [trackID];
    
            if (this.Indexes.TRACKS_BY_GENRE[Genres]) 
                this.Indexes.TRACKS_BY_GENRE[Genres].push(trackID);
            else
                this.Indexes.TRACKS_BY_GENRE[Genres] = [trackID];

            if (!this.Indexes.ALBUMS_PER_ALBUM_ARTIST[AlbumArtists])
                this.Indexes.ALBUMS_PER_ALBUM_ARTIST[AlbumArtists] = [Album];
            
            if (this.Indexes.ALBUMS_PER_ALBUM_ARTIST[AlbumArtists].indexOf(Album) === -1)
                this.Indexes.ALBUMS_PER_ALBUM_ARTIST[AlbumArtists].push(Album);
        }
    
        Object.freeze(this.Indexes.TRACKS_BY_ALBUM);
        Object.freeze(this.Indexes.TRACKS_BY_ALBUM_ARTIST);
        Object.freeze(this.Indexes.TRACK_BY_TRACK_ARTIST);
        Object.freeze(this.Indexes.TRACKS_BY_GENRE);
        Object.freeze(this.Indexes.ALBUMS_PER_ALBUM_ARTIST);

        Object.freeze(this);
        this.events.manager.trigger(this.events.types.INDEX_MANAGER_INDICES_BUILT, {tracks_parsed: Object.keys(this.MasterAudioTrackIndex).length});
        console.log(`IndexManager: indices built and ready`);
    }

    getTrackData(trackID) {
        return this.MasterAudioTrackIndex[trackID] || {ERROR: "INDEX DOES NOT EXIST FOR TRACKID" + trackID};
    }

    getCollection(filter=0, filterString="") {
        let start = performance.now();
        let returnData = {};
        
        for(let albumArtist in this.Indexes.ALBUMS_PER_ALBUM_ARTIST) {
            returnData[albumArtist] = {};
            let currentArtistCollection = returnData[albumArtist];
            let currentArtistName = albumArtist;
            
            this.Indexes.ALBUMS_PER_ALBUM_ARTIST[albumArtist].forEach(albumName=> {
                let currentAlbumName = albumName;
                // No filter active? Just return all tracks belonging to a given album
                if (filter === 0) {
                    currentArtistCollection[albumName] = this.Indexes.TRACKS_BY_ALBUM[albumName];
                    return;
                }

                // Guard against undefined or too short filter strings
                if (typeof filterString !== typeof "" || typeof filterString === typeof "" && filterString.length < 3)
                    return {};
                
                filterString = filterString.toLowerCase();
                returnData[currentArtistName][currentAlbumName] = [];
                let currentAlbum = currentArtistCollection[currentAlbumName];
                
                this.Indexes.TRACKS_BY_ALBUM[albumName].forEach(albumTrack=> {

                    let trackData = this.MasterAudioTrackIndex[albumTrack];
                    
                    if ((filter & this.FILTER.TITLE) === this.FILTER.TITLE && trackData.Title.toLowerCase().indexOf(filterString) > -1) {
                        currentAlbum.push(albumTrack);
                        return;
                    }
                    if ((filter & this.FILTER.ALBUM) === this.FILTER.ALBUM && trackData.Album.toLowerCase().indexOf(filterString) > -1) {
                        currentAlbum.push(albumTrack);
                        return;
                    }
                    if ((filter & this.FILTER.ARTIST) === this.FILTER.ARTIST && trackData.TrackArtists.toLowerCase().indexOf(filterString) > -1) {
                        currentAlbum.push(albumTrack);
                        return;
                    }
                    if ((filter & this.FILTER.GENRE) === this.FILTER.GENRE && trackData.Genres.toLowerCase().indexOf(filterString) > -1) {
                        currentAlbum.push(albumTrack);
                        return;
                    }
                });

                if (!currentAlbum.length)
                    delete returnData[currentArtistName][currentAlbumName];
                else
                    returnData[currentArtistName][currentAlbumName].sort((a,b)=> {
                        return this.MasterAudioTrackIndex[a].Position - this.MasterAudioTrackIndex[b].Position;
                    });
            });

            if (!Object.keys(returnData[albumArtist]).length)
                delete returnData[albumArtist];
        }

        console.warn(`getCollection took ${(performance.now() - start).toFixed(2)} ms`);
        return JSUtils.deepFreeze(returnData);
    }
} 