<cfinclude template="CheckAuth.cfm" />

<!DOCTYPE html>
<html lang="en">

	<head>
		<title>FrenglerAMP</title>
		<meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <link rel="stylesheet" href="Lib/JS/fontawesome-free-5.13.1-web/css/all.min.css" />
        <link rel="stylesheet" href="Lib/CSS/main.css" />

        <script type="module" src="Lib/JS/main.js" ></script>

        <!--
            // https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource
            // https://stackoverflow.com/questions/22604500/web-audio-api-working-with-decibels
            // decibel_level = 20 * Math.log10( gain.value );
            // gain.value = Math.pow(10, (decibel_level / 20)); This is what we need to convert the values from the tags to the value used by the gain node

            // M4A-files
            /*
                These need to be properly fragmented, which most of ours aren't.
                This can be done using mp4fragment (https://www.bento4.com/documentation/mp4fragment/)
                which is a commandline-tool like this:

                mp4fragment --track "audio" "input_file_name.m4a" "output_file_name.m4a"

                https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API/Transcoding_assets_for_MSE
            */

            /* BYTES PER SECOND
                (bitrate * duration) / 8 = size_of_payload
                bitrate / 8 = bytes_per_second
            */

            TODO(thomas):
            - Creating, modifying, deleting, loading playlists
            - Re-ordering playlist (drag/drop)
        -->
    </head>

    <body>
        <cfif structKeyExists(URL, "DevMode") AND URL.DevMode EQ 1 >
            <cfdump var=#structCount(application.backendIndex)# label="BackendIndex" />
            <hr/>
        </cfif>

        <section id="Playlist">
            <div id="PlaylistHeader">
                <i class="fas fa-stream" style="color: green" ></i>
                :&nbsp;
                <i id="ShowHidePlayList" class="fas fa-eye-slash"></i>
                &nbsp;-&nbsp;
                <i id="ClearPlaylist" class="fas fa-ban"></i>
                &nbsp;-&nbsp;
                <span>
                    <i class="fas fa-random"></i>
                    <input id="ShufflePlaylist" type="checkbox" />
                </span>
            </div>
            <hr/>
            <div id="PlaylistBody" style="display: block;" ></div>
        </section>

        <button id="UI_Previous">PREVIOUS</button>
        <span>&nbsp;|&nbsp;</span>
        <button id="UI_Play">PLAY</button>
        <button id="UI_Pause">PAUSE</button>
        <button id="UI_Mute">MUTE</button>
        <span>&nbsp;|&nbsp;</span>
        <button id="UI_Next">NEXT</button>

        <p>
            <span id="UI_Volume" >100%</span>
            <span>|</span>
            <input id="UI_Volume_Slider" type="range" min="0.1" max="1.0" step="0.1" value="1.0" />
            <span>|</span>
            <span id="UI_Player_State" >N/A</span> <!-- playing, muted, paused -->
        </p>

        <table>
            <tbody>
                <tr>
                    <th>Play cursor: </th>
                    <td id="UI_PlayCursor">00:00</td>
                </tr>
                <tr>
                    <th>Duration: </th>
                    <td id="UI_Player_Duration">0 | 0</td>
                </tr>
                <tr>
                    <th>Buffered until: </th>
                    <td id="UI_Buffered_Until">00:00</td>
                </tr>
                <tr>
                    <th>Buffered from: </th>
                    <td id="UI_Buffer_Tail">00:00</td>
                </tr>
                <tr>
                    <th>Audio buffer: </th>
                    <td><meter id="UI_Audio_Buffer" optimum="0"></meter> <span id="UI_Audio_Buffer_Limit">0</span></td>
                </tr>
                <tr>
                    <th>Bytes read: </th>
                    <td><progress id="UI_Datastream_Progress" max="0" value="0"></progress> <span id="UI_Datastream_BytesRead">0</span></td>
                </tr>
                <tr>
                    <th>Bytes expected: </th>
                    <td id="UI_Datastream_BytesExpected">0</td>
                </tr>
                <tr>
                    <th>AudioObject state: </th>
                    <td id="UI_AudioObject_State">N/A</td>
                </tr>
                <tr>
                    <th>Datastream state: </th>
                    <td id="UI_Datastream_State">N/A</td>
                </tr>
            </tbody>
        </table>

        <table>
            <tbody>
                <tr>
                    <th>TrackID: </th>
                    <td id="UI_TrackID">N/A</td>
                </tr>
                <tr>
                    <th>Title: </th>
                    <td id="UI_Title">N/A</td>
                </tr>
                <tr>
                    <th>Album: </th>
                    <td id="UI_Album">N/A</td>
                </tr>
                <!-- <tr>
                    <th>AlbumArtists</th>
                    <td>N/A</td>
                </tr> -->
                <tr>
                    <th>TrackArtists: </th>
                    <td id="UI_TrackArtists">N/A</td>
                </tr>
                <tr>
                    <th>Year: </th>
                    <td id="UI_Year">N/A</td>
                </tr>
                <tr>
                    <th>Genres: </th>
                    <td id="UI_Genres">N/A</td>
                </tr>
                <tr>
                    <th>Duration: </th>
                    <td id="UI_Duration">N/A</td>
                </tr>
                <tr>
                    <th>Mimetype: </th>
                    <td id="UI_Mimetype">N/A</td>
                </tr>
                <tr>
                    <th>Size: </th>
                    <td id="UI_Size">N/A</td>
                </tr>
                <tr>
                    <th>ReplayGain: </th>
                    <td id="UI_ReplayGain">N/A</td>
                </tr>
            </tbody>
        </table>

        <hr/>
        <h2>
            <span>MUSIC LIBRARY --</span>
            <label for="LibraryShowHide">SHOW/HIDE:</label>
            <input type="checkbox" id="LibraryShowHide" checked />
        </h2>

        <section id="LibraryControls">
            <form name="LibraryControlForm" action="javascript:;" method="GET"  >

                <section id="LibrarySearch">
                    <input type="button" id="ResetLibrary" value="RESET" />
                    <input type="button" id="SelectAllInLibrary" value="SELECT ALL" />
                    <br/><br/>

                    <div>
                        <input name="LibrarySearchOption" value="Artist" type="checkbox" id="LibrarySearchOnArtist" checked />
                        <label for="LibrarySearchOnArtist">Search on artist</label>
                    </div>
                    <div>
                        <input name="LibrarySearchOption" value="Title" type="checkbox" id="LibrarySearchOnTitle" />
                        <label for="LibrarySearchOnTitle">Search on title</label>
                    </span>
                    <div>
                        <input name="LibrarySearchOption" value="Album" type="checkbox" id="LibrarySearchOnAlbum" />
                        <label for="LibrarySearchOnAlbum">Search on album</label>
                    </div>
                    <div>
                        <input name="LibrarySearchOption" value="Genre" type="checkbox" id="LibrarySearchOnGenre" />
                        <label for="LibrarySearchOnGenre">Search on genre</label>
                    </span>
                    <div>
                        <input readonly type="text" id="LibrarySearchText" placeholder="Loading, please wait..." />
                        <input type="button" id="SearchLibrary" value="GO!" disabled />
                    </div>
                </section>

            </form>
        </section>

        <br/>

        <section id="LibraryList"></section>

        <hr/>

        <h2>LOG:</h2>
        <section id="LogOutput"></section>
    </body>
</html>