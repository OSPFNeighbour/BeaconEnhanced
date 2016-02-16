console.log("inject running");
whenWeAreReady(msgsystem,function() {
	
	//Home HQ
	whenWeAreReady(user,function() {
		console.log("Setting Selected HQ to user HQ");
		msgsystem.setSelectedHeadquarters(user.hq);
	});

	//Operational = true
	msgsystem.operational(true);

});

function whenWeAreReady(varToCheck,cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
  	if (typeof varToCheck != "undefined") {
  		console.log("We are ready");
      clearInterval(waiting); //stop timer
      cb(); //call back
  }
}, 200);
}


msgsystem.loadingContacts.subscribe(function(status) {
	console.log(status);
if (status == false)
{
	msgsystem.availableContactGroups.peek().forEach(function(item){
	console.log(item);

		if (item.Name.indexOf("(default)") > -1){
		msgsystem.addContactGroup(item);
	}


})

}
})

