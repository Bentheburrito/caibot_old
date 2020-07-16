# Confederation of Auraxian Information (C.A.I.) Bot

Invite Link:
https://discord.com/oauth2/authorize?client_id=520652944622878744&scope=bot&permissions=1409674320

## Info
This bot provides access to a variety of PlanetSide 2 info easily from Discord. Features include:
* Search for characters, outfits, weapons, and character/weapon stats.
* Subscribe to alert & event notifications on your server(s) within a time window.
* View your latest play session in detail, with over-time performance comparison.
* View unlocked continents and their events on every server.


## Commands
\* means optional argument
### Planetside Commands:
* !character (!c/!char)
View a character's general info and online status.  
__Usage:__ !character [Character Name]

* !characterweaponstats (!cws/!ws/!wstats/!cw/!charw)
View a character's weapon stats.  
__Usage:__ !characterweaponstats [Character Name] [Weapon Name]

* !events
View a list of in-game events to subscribe to.

* !outfit (!o/!out)
View an outfit's members and their collective stats.  
__Usage:__ !outfit [Name]

* !outfittag (!ot/!tag)
View an outfit's members and their collective stats.  
__Usage:__ !outfittag [Tag]

* !session (!se)
View a character's most recent play session.  
__Usage:__ !session [Character Name]  
__Definitions__  
KDR = Kill/Death Ratio, KPM = Kills Per Minute, VKDR = Vehicle KDR, IvI = Infantry vs. Infantry, HSR = Headshot Ratio, ACC = Accuracy, IvI Score = HSR * ACC

* !stats (!s/!stat/!cstat)
View a character's lifetime stats.  
__Usage:__ !stats [Character Name] *[Weapon name]

* !status (!server)
Quickly get a server's online status.  
__Usage:__ !status [Server Name]

* !subscribe (!sub/!subscriptions)
Have the bot DM you when `Event Name` starts on the servers `Server Name`s. Note: If `Event Name` is more than one word, wrap it in quotes (example below.)  
__Usage:__ !subscribe "[Event Name]" [Server Name 1] ... [Server Name X]  
__Examples__  
!sub "aerial anomalies" connery miller - subscribe to Aerial Anomalies events on Connery and Miller  
!sub "refine and refuel" - subscribe to Refine and Refuel events on __all servers__  
!sub - view all your event subscriptions.\n\nUse !events for a list of accepted events.

* !unsubscribe (!unsub)
Unsubscribe from an event. Note: If `Event Name` is more than one word, wrap it in quotes (example below.)  
__Usage:__ !unsubscribe "[Event Name]" [Server Name 1] ... [Server Name X]  
__Examples__  
!unsub "aerial anomalies" connery miller - unsubscribe to Aerial Anomalies events on Connery and Miller  
!sub "refine and refuel" - unsubscribe to Refine and Refuel events on __all servers__

* !weapon (!w/!weapon/!wstat)
View weapon info (Damage, clip size, etc.).  
__Usage:__ !weapon [Weapon Name]

### Public Commands:
* !bug
Report a bug with PS2 Status Bot.  
__Usage:__ !bug [Bug Description]

* !help
List available public commands.  
__Usage:__ !help *[Command Name]'

* !info
Get info/links related to the bot.  
__Usage:__ !info

* !profile
View someone's PS2 Status Discord profile.  
__Usage:__ !profile *[Discord Username]

* !role
Assign and remove roles.  
__Usage:__ !role [Roll Name]

* !roll
Rolls a virtual dice.  
__Usage:__ !roll <# of sides> (Defaults to 6).

* !timezone
Set your time zone for event/continent alerts.  
__Usage:__ !timezone

### Admin Commands:
* !setstatuschannel (!ssc)
Set the channel to post an updated server status message.
__Usage:__ !ssc *[channelName]


Please use !bug [bug description] to report any issues!