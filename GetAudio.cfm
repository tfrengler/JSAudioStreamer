<cfheader name="access-control-allow-credentials" value="true" />
<cfheader name="access-control-allow-headers" value="range" />  
<cfheader name="accept-ranges" value="bytes" />
<cfheader name="access-control-allow-methods" value="GET, HEAD, OPTIONS" />
<cfheader name="access-control-allow-origin" value="*" />
<cfheader name="access-control-expose-headers" value="*" />
<cfheader name="access-control-max-age" value="86400" />

<cfset filePath = "#expandPath(".")#/#URL.fileName#.mp3" />

<cfheader name="Content-Disposition" value="attachment; filename=AudioTrack" />

<cfif structKeyExists(getHTTPRequestData().headers, "range") IS false >
    <cfheader name="Content-Length" value=#getFileInfo(filePath).size# />
</cfif>

<cfcontent file=#filePath# type=#fileGetMimeType(filePath)# />