<cfcomponent output="false">

	<cfset this.name="AudioStreamTest2" />
	<cfset this.applicationtimeout = createTimeSpan(1,0,0,0) />
	<cfset this.sessiontimeout = createTimespan(0, 1, 0, 0) />
	<cfset this.sessionmanagement = false />
	<cfset this.setClientCookies = false />
	<!--- <cfset this.javaSettings.loadPaths = "./jars" /> --->

	<cffunction name="onApplicationStart" returnType="boolean" output="false" >
		<cfreturn true />
	</cffunction>

	<cffunction name="onRequestStart" returntype="boolean" output="false" >
		<cfreturn true />
	</cffunction>

</cfcomponent>