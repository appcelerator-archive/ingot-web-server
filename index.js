var bodyParser = require('body-parser'),
	bower = require('bower'),
	cookieParser = require('cookie-parser'),
	express = require('express'),
	favicon = require('serve-favicon'),
	http = require('http'),
	morgan = require('morgan'),
	responseTime = require('response-time'),

	logger,
	app = express(),
	httpServer,
	router = express.Router(),
	running = false,
	httpSockets = [];

/**
 * The Express app
 */
exports.app = app;

/**
 * A router that other services can tack on http handlers to
 */
exports.router = router;

/**
 * Homepage handler
 */
router.all('/', function (req, res) {
	res.render('index');
});

/**
 * Initializes the Express app
 */
exports.load = function load(cfg, callback) {
	callback || (callback = function () {});

	cfg || (cfg = {});
	var httpLogger;
	if (cfg.logger) {
		cfg.logger.addLevel('www', 'cyan');
		cfg.logger.addLevel('http', 'grey');
		logger = cfg.logger.www;
		httpLogger = cfg.logger.http;
	}

	app.locals.title = 'Appcelerator Web Server Service';

	app.use(responseTime(5));

	app.set('views', __dirname + '/views');
	app.set('view engine', 'hjs');
	app.set('layout', 'layouts/default');
	app.engine('hjs', require('hogan-express'));

	app.use(morgan({
		format: 'dev',
		stream: {
			write: function (msg) {
				httpLogger && httpLogger(msg.trim());
			}
		}
	}));
	app.use(favicon(__dirname + '/public/img/favicon.png'));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded());
	app.use(cookieParser());
	app.use(express.static(__dirname + '/public'));

	app.use(router);

	app.use(function (req, res, next) {
		res.status(404);
		res.render('404');
	});

	// development error handler
	// will print stacktrace
	if (app.get('env') === 'development') {
		app.use(function (err, req, res, next) {
			res.status(err.status || 500);
			res.render('500', {
				message: err.message,
				error: err
			});
		});
	}

	// production error handler
	// no stacktraces leaked to user
	app.use(function (err, req, res, next) {
		res.status(err.status || 500);
		res.render('500', {
			message: err.message,
			error: {}
		});
	});

	logger('installing bower components');
	bower.commands.install([], {}, {
		cwd: __dirname,
		directory: 'public/lib'
	}).on('error', callback).on('end', function () { callback(); });
};

/**
 * Starts the http server
 * @param {Object} [cfg] - Configuration object
 * @param {Function} [callback] - A function to call when the http server is running
 */
exports.start = function start(cfg, callback) {
	if (running) return callback(new Error('Already running'));

	if (typeof cfg === 'function') {
		callback = cfg;
		cfg = {};
	} else if (!cfg) {
		cfg = {};
	}

	var port = cfg['ingot-web-server'] && cfg['ingot-web-server'].port || 8080;
	httpServer = http.createServer(app).listen(port, function () {
		logger('started server on port %d', port);
		running = true;
		typeof callback === 'function' && callback();
	});

	httpServer.on('connection', function (socket) {
		httpSockets.push(socket);
		socket.on('close', function () {
			httpSockets.splice(httpSockets.indexOf(socket), 1);
		});
	});
};

/**
 * Stops the http server
 * @param {Function} [callback] - A function to call when the http server has stopped
 */
exports.stop = function stop(cfg, callback) {
	if (!running) return callback();

	for (var s; s = httpSockets.shift();) {
		s.destroy();
	}

	httpServer.close(function () {
		running = false;
		callback();
	});
};

exports.unload = function unload() {
	//
};