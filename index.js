var host = "http://localhost:6970";

function initGraph() {
	var settingsStoryData = {
	  "async": true,
	  "crossDomain": true,
	  "url": host+"/sprint/tasks?expand=true",
	  "method": "GET",
	  "headers": {
	    "content-type": "application/json"
	  }
	}

	var settingsSprintData= {
	  "async": true,
	  "crossDomain": true,
	  "url": host+"/sprint/data",
	  "method": "GET",
	  "headers": {
	    "content-type": "application/json"
	  }
	}

	var layout = {
		barmode: 'stack',
		showlegend : true,
		title : 'Sprint Execution Diagram : ',
		yaxis : {
			nticks : 100,
			title : 'User Stories'
		},
		xaxis : {
			showline : true,
			title : 'Days spent in phase',
			nticks : 100
		}
	};

	/**
	 * @param  {[type]}
	 * @param  {[type]}
	 * @param  {[type]}
	 * @return {[type]}
	 */
	function getHistogramData(phase, formattedResponse, startDate) {


		var minDate;
		var phaseReady = formattedResponse.filter((_i) => _i.status !== phase && _i.changes.find((_c) => _c.from === phase));
		
		function sortDescAndFind(collection, phase, fromTo) {
			return [].concat(collection).sort((_c1, _c2) => new Date(_c2.happened).getTime() - new Date(_c1.happened).getTime()).find((_c) => _c[fromTo] === phase)
		}

		if (startDate) {
			minDate = new Date(startDate);
		} else {

			// choose min date to see where to start the Gantt chart
			var earliestChange = [].concat(phaseReady).sort((a,b) => new Date(sortDescAndFind(a.changes, phase, "to").happened).getTime() 
											     - new Date(sortDescAndFind(b.changes, phase, "to").happened).getTime())[0];

			minDate = earliestChange ? new Date(sortDescAndFind(earliestChange.changes, phase, "to").happened) : Date.now();
		}

		var filteredTasks = phaseReady.map((_i) => { 

							if (_i.key === "ANG-457" && phase === "Ready for DoT") {
								console.log(_i.changes);
								console.log("from", _i.changes.filter((_c) => _c.from === phase));
								console.log("to", _i.changes.filter((_c) => _c.to === phase));
							}
							return {
										key : _i.key, 
										from : new Date(sortDescAndFind(_i.changes, phase, "from").happened).getTime(), 
										to : new Date(sortDescAndFind(_i.changes, phase, "to").happened).getTime()
									}
							}).filter((_p) => _p.to > minDate.getTime());		

		
		var offset = filteredTasks.map((_i) => _i.to - minDate.getTime());
		var duration = filteredTasks.map((_i) => Math.max(_i.from,minDate.getTime()) - _i.to);

		var ret = {
			offset : offset,
			duration : duration,
			minDate : minDate,
			yaxis : filteredTasks.map((_i) => _i.key)
		};

		return ret;
	}

	/**
	 * @param  {[type]}
	 * @param  {[type]}
	 * @return {[type]}
	 */
	function chooseMaxValueFromData(array, max) {
		var maxValue = max;

		array.forEach((v) => {
			if (v > maxValue) {
				maxValue = v;
			}
		});

		return maxValue;
	}

	/**
	 * @return {[type]}
	 */
	function getRandomColor() {
	  var letters = '0123456789ABCDEF';
	  var color = '#';
	  for (var i = 0; i < 6; i++) {
	    color += letters[Math.floor(Math.random() * 16)];
	  }
	  return color;
	}

	function plotGanttChart(sprintName, startDate) {
		layout.title += sprintName;

		$.ajax(settingsStoryData).done((response) => {
			//format data
			var formattedResponse = response.issues.filter((_i) => _i.fields.issuetype.name !== "Epic")
										  .filter( (_i) => _i.changelog.histories.filter( (_c) => _c.items[0].field === "status"))
										  .map((_i) => { return { 
										  		key : _i.key, 
										  		status : _i.fields.status.name,
										  		changelog : _i.changelog.histories.filter( (_c) => _c.items[0].field === "status") 
										  	}
										  }).map((_i) => { return { 
										  		key : _i.key,
										  		status : _i.status,
										  		changes : _i.changelog.map((_s) => { return {happened : _s.created, from : _s.items[0].fromString, to : _s.items[0].toString}})
										  	}
										  });
										  
			// choose all finished phases
			var finishedPhases = [].concat.apply([],(formattedResponse.map((_i) => _i.changes))).map((_i) => _i.from).filter((_i, index, self) => self.indexOf(_i) === index);
			var inProgressData = getHistogramData("In Progress", formattedResponse, startDate);
			var minDate = startDate || inProgressData.minDate;

			var phasesData = [];
			var yaxis = [];
			phasesData.push(inProgressData.offset);
			phasesData.push(inProgressData.duration);
			// one for the offset, and one for the duration
			yaxis.push(inProgressData.yaxis);
			yaxis.push(inProgressData.yaxis);

			finishedPhases.filter((_p) => _p !== "In Progress" && _p !== "Open" && _p !== "Done").forEach((_p) => {
				var phaseHistogram = getHistogramData(_p, formattedResponse, minDate);
				phasesData.push(phaseHistogram.duration);
				yaxis.push(phaseHistogram.yaxis);
			});

			var data = [];
			phasesData.forEach((_pd, i) => {
				var trace = {
					x : _pd.map((_p) => (_p/3600000)/24),
					y : yaxis[i],
					type : "bar",
					marker: {
						color: "transparent"
					},
					orientation : 'h',
					name : ''
				}

				if (i > 0) {
					trace.name = finishedPhases.filter((_ph) => _ph !== "Open")[i-1]
					trace.marker.color = getRandomColor();
				}

				data.push(trace);
			});

			Plotly.newPlot(document.getElementById("chart"), data, layout);
		});

	}

	$.ajax(settingsSprintData).done((sprintData) => {
		var sprint;

		if (sprintData.values && sprintData.values.length) {
			sprint = sprintData.values[0];
		} else if (sprintData.self) {
			sprint = sprintData;
		} else {
			console.warn("No data could be retrieved", settingsSprintData);
			throw true;
		}

		plotGanttChart(sprint.name, sprint.startDate);
	});
}

document.addEventListener('DOMContentLoaded', function() { 
	initGraph();
});