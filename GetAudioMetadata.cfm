<cfheader name="access-control-allow-credentials" value="true" />
<cfheader name="access-control-allow-methods" value="GET, HEAD, OPTIONS" />
<cfheader name="access-control-allow-origin" value="*" />
<cfheader name="access-control-expose-headers" value="*" />
<cfheader name="access-control-max-age" value="86400" />

<cfset filePath = "#expandPath(".")#/#URL.fileName#.json" />

<cfheader name="Content-Disposition" value="attachment; filename=AudioTrackMetadata" />

<cfheader name="Content-Length" value=#getFileInfo(filePath).size# />
<cfcontent file=#filePath# type=#fileGetMimeType(filePath)# />