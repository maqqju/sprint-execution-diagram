var connect = require('connect');
var serveStatic = require('serve-static');
connect().use(serveStatic(__dirname)).listen(6980, () => {
	console.log('Server running on 6980');
});