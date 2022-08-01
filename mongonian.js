const peri = '@perigress/perigress';
const OutputFormat = require(peri+'/src/output-format.js');
const template = require('es6-template-strings');
const arrays = require('async-arrays');
const access = require('object-accessor');
const validate = require('jsonschema').validate;
const ks = require('kitchen-sync');
const {
	stringsToStructs, 
	copyJSON, 
	handleList, 
	getExpansions, 
	makeLookup, 
	handleBatch, 
	handleListPage
} = require('./util.js');

const QueryDocumentSchema = {
	type: 'object',
	description: 'Any listing can be arbitrarily filtered using <a href="https://www.mongodb.com/docs/manual/core/document/#std-label-document-query-filter">Mongo Query Document Filters</a>',
	additionalProperties: {
		type: 'object',
		properties: {
			"$in": {type:'array', required:false},
			"$nin": {type:'array', required:false},
			"$exists": {type:'boolean', required:false},
			"$gte": {type:'number', required:false},
			"$gt": {type:'number', required:false},
			"$lte": {type:'number', required:false},
			"$lt": {type:'number', required:false},
			"$eq": { required:false},
			"$ne": { required:false},
			"$mod": {type:'array', required:false},
			"$all": {type:'array', required:false},
			"$and": {
					type:'array', 
					items:{
						$ref:'#/components/schemas/QueryDocumentFilter'
					}, required:false
			},
			"$or": {
					type:'array', 
					items:{
						$ref:'#/components/schemas/QueryDocumentFilter'
					}, required:false
			},
			"$nor": {
					type:'array', 
					items:{
						$ref:'#/components/schemas/QueryDocumentFilter'
					}, required:false
			},
			"$not": {
					type:'array', 
					items:{
						$ref:'#/components/schemas/QueryDocumentFilter'
					}, required:false
			},
			"$size": {type:'integer', required:false},
			"$type": {type:'object', required:false},
			"$lt": {type:'number', required:false},
			"$elemMatch": {type:'object', required:false}
		}
	}
};

const Mongonian = OutputFormat.extend({
	mutateEndpoint : function(endpoint){
		endpoint.list = function(options, cb){
			let callback = ks(cb);
			try{
			handleList(
				this, 
				(options.pageNumber?parseInt(options.pageNumber):1), 
				`js://${this.options.name}/`, 
				this.instances, 
				options, 
				(err, returnValue, set, len, write)=>{
					callback(null, set);
				}
			);
		}catch(ex){
			console.log(ex);
		}
			return callback.return;
		}
		
		endpoint.batch = function(options, tree, cb){
			let callback = ks(cb);
			try{
				handleBatch(
					this, 
					(options.pageNumber?parseInt(options.pageNumber):1), 
					`js://${this.options.name}/`, 
					this.instances, 
					options, 
					(err, returnValue, set, len, write)=>{
						callback(null, set);
					}
				);
			}catch(ex){
				console.log(ex);
			}
			return callback.return;
		}
		
		endpoint.create = function(options, cb){
			let callback = ks(cb);
			if(validate(options.body, this.originalSchema)){
				this.instances[options.body[primaryKey]] = options.body;
				callback(null, options.body);
			}else{
				callback(new Error("the provided data was not valid"));
			}
			return callback.return;
		}
		
		endpoint.read = function(options, cb){
			let callback = ks(cb);
			let config = this.config();
			let primaryKey = config.primaryKey || 'id';
			if(this.instances[options[primaryKey]]){
				callback(null, this.instances[options[primaryKey]])
			}else{
				this.generate(options[primaryKey], (err, generated)=>{
					callback(null, generated)
				});
			}
			return callback.return;
		}
		
		endpoint.update = function(options, cb){
			let callback = ks(cb);
			let config = this.config();
			let primaryKey = config.primaryKey || 'id';
			endpoint.getInstance(options[primaryKey], (err, item)=>{
				if(options.body && typeof options.body === 'object'){
					Object.keys(options.body).forEach((key)=>{
						item[key] = options.body[key];
					});
					//item is now the set of values to save
					if(validate(item, this.originalSchema)){
						this.instances[options[primaryKey]] = item;
						callback(null, item);
					}else{
						//fail
						callback(new Error('Failed to update item'))
					}
				}else{
					//fail
					callback(new Error('Failed to update item'))
				}
			})
			return callback.return;
		}
		
		endpoint.delete = function(options, cb){
			let callback = ks(cb);
			
			return callback.return;
		}
	},
	attachRoot : function(expressInstance, endpoint, {
		prefix, 
		urlPath, 
		config, 
		errorConfig, 
		primaryKey,
		resultSpec,
		cleaned,
		readOnly,
		pathOptions
	}){
		
	},
	attachEndpoint : function(expressInstance, endpoint, {
			prefix, 
			urlPath, 
			config, 
			errorConfig, 
			primaryKey,
			resultSpec,
			cleaned,
			readOnly,
			pathOptions
		}){
			
		let urls = {
			list : template(
				(
					(config.paths && config.paths.list) ||
					'${basePath}/list'
				),
				pathOptions
			),
			save : template(
				(
					(config.paths && config.paths.save) ||
					'${basePath}/save'
				),
				pathOptions
			),
			listPage : template(
				(
					(config.paths && config.paths.listPage) ||
					'${basePath}/list/:pageNumber'
				),
				pathOptions
			),
			create : template(
				(
					(config.paths && config.paths.create) ||
					'${basePath}/create'
				),
				pathOptions
			),
			edit : template(
				(
					(config.paths && config.paths.edit) ||
					'${basePath}/:${primaryKey}/edit'
				),
				pathOptions
			),
			display : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/:${primaryKey}'
				),
				pathOptions
			),
			listSchema : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/list-schema.json'
				),
				pathOptions
			),
			itemSchema : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/display-schema.json'
				),
				pathOptions
			),
			createSchema : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/create-schema.json'
				),
				pathOptions
			),
			editSchema : template(
				(
					(config.paths && config.paths.display) ||
					'${basePath}/edit-schema.json'
				),
				pathOptions
			)
		};
			
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.list, (req, res)=>{
			let options = typeof req.body === 'string'?req.params:req.body;
			handleListPage(endpoint, 1, req, res, urlPath, endpoint.instances, options);
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.save, (req, res)=>{
			let options = typeof req.body === 'string'?req.params:req.body;
			handleBatch(endpoint, 1, req, res, urlPath, endpoint.instances, options, true);
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.listPage, (req, res)=>{
			let options = typeof req.body === 'string'?req.params:req.body;
			handleListPage(endpoint, parseInt(req.params.pageNumber), req, res, urlPath, endpoint.instances, options);
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.create, (req, res)=>{
			if(validate(req.body, endpoint.originalSchema)){
				let item = req.body;
				if(!item[primaryKey]) item[primaryKey] = Math.floor(Math.random()* 1000000000)
				endpoint.instances[item[primaryKey]] = item;
				endpoint.returnContent(res, {success: true, result: item}, errorConfig, config);
			}else{
				res.send('{"error":true, "message":"the provided data was not valid"}')
			}
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.edit, (req, res)=>{
			endpoint.getInstance(req.params[primaryKey], (err, item)=>{
				if(req.body && typeof req.body === 'object'){
					Object.keys(req.body).forEach((key)=>{
						item[key] = req.body[key];
					});
					//item is now the set of values to save
					if(validate(item, endpoint.originalSchema)){
						endpoint.instances[req.params[primaryKey]] = item;
						endpoint.returnContent(res, {success:true}, errorConfig, config);
					}else{
						//fail
						console.log('**')
					}
				}else{
					//fail
					console.log('*', req.body, req)
				}
			})
		});
		
		expressInstance[
			endpoint.endpointOptions.method.toLowerCase()
		](urls.display, (req, res)=>{
			let config = endpoint.config();
			let primaryKey = config.primaryKey || 'id';
			if(endpoint.instances[req.params[primaryKey]]){
				res.send(JSON.stringify(endpoint.instances[req.params[primaryKey]], null, '    '))
			}else{
				endpoint.generate(req.params[primaryKey], (err, generated)=>{
					res.send(JSON.stringify(generated, null, '    '))
				});
			}
		});
	},
	attachSpec : function(){
		
	},
	attachEndpointSpec : function(){
		expressInstance[
			this.endpointOptions.method.toLowerCase()
		](urls.listSchema, (req, res)=>{
			let cleanedCopy = JSON.parse(JSON.stringify(cleaned));
			if(cleanedCopy.properties && cleanedCopy.properties.results){
				cleanedCopy.properties.results.items = this.schema;
			}
			
			jsonSchemaFaker.resolve(cleaned, [], process.cwd()).then((exampleReturn)=>{
				this.generate(1, (err, generated)=>{
					exampleReturn.results = [generated];
					res.send(JSON.stringify({
						post:{
							summary: template('Request a list of ${objectName}s', opts ),
							description: template('Request a list of ${objectName}s with an optional filter and the ability to bind subobjects together into trees.', opts),
							requestBody: {
								required: false,
								content: {
									'application/json' : {
										schema : {
											type: "object",
											properties: {
												query : { $ref:'#/components/schemas/QueryDocumentFilter' },
												link: {type: "array", required: false, items:{ type: "string" }}
											}
										}
									}
								}
							},
							parameters:{
								
							},
							responses:{
								'200': {
									description: template('The ${objectName} that was saved.', opts ),
									content: {
										'application/json' : {
											schema : cleanedCopy,
											example: exampleReturn
										}
									}
								}
							}
						},
						components: {
							schemas: { QueryDocumentFilter : QueryDocumentSchema }
						}
					}));
				});
			}).catch((ex)=>{
				console.log(ex);
			});
			
		});
		
		expressInstance[
			this.endpointOptions.method.toLowerCase()
		](urls.itemSchema, (req, res)=>{
			this.generate(1, (err, generated)=>{
				res.send(JSON.stringify({
					post:{
						summary: template('Request a single ${objectName}', opts ),
						description: template('Request a single ${objectName}, by it\'s id', opts),
						parameters:[
							{
								name: 'id',
								in: 'path',
								required: true,
								description: template('The id of the ${objectName}', opts),
								schema:{
									type : 'integer',
									format: 'int64',
									minimum: 1
								}
							}
						],
						responses:{
							'200': {
								description: template('The requested ${objectName}.', opts ),
								content: {
									'application/json' : {
										schema : this.schema,
										example: generated
									}
								}
							}
						}
					}
				}));
			});
		});
		
		expressInstance[
			this.endpointOptions.method.toLowerCase()
		](urls.editSchema, (req, res)=>{
			this.generate(1, (err, generated)=>{
				let writable = {};
				Object.keys(generated).forEach((key)=>{
					if(readOnly.indexOf(key) === -1 ) writable[key] = generated[key];
				});
				res.send(JSON.stringify({
					post:{
						summary: template('Save an existing ${objectName}', opts ),
						description: template('Update an instance of ${objectName} with new values', opts),
						parameters:[
							{
								name: 'id',
								in: 'path',
								required: true,
								description: template('The id of the ${objectName}', opts),
								schema:{
									type : 'integer',
									format: 'int64',
									minimum: 1
								}
							}
						],
						requestBody: {
							required: true,
							content: {
								'application/json' : {
									schema : this.schema,
									example: writable
								}
							}
						},
						responses:{
							'200': {
								description: template('The ${objectName} that was saved.', opts ),
								content: {
									'application/json' : {
										schema : this.schema,
										example : generated
									}
								}
							}
						}
					}
				}))
			});
		});
		
		expressInstance[
			this.endpointOptions.method.toLowerCase()
		](urls.createSchema, (req, res)=>{
			this.generate(1, (err, generated)=>{
				let writable = {};
				Object.keys(generated).forEach((key)=>{
					if(readOnly.indexOf(key) === -1 ) writable[key] = generated[key];
				});
				res.send(JSON.stringify({
					post:{
						summary: template('Save a new ${objectName}', opts ),
						description: template('Save a new instance of ${objectName}', opts),
						parameters:[],
						requestBody: {
							required: true,
							content: {
								'application/json' : {
									schema : this.schema,
									example: writable
								}
							}
						},
						responses:{
							'200': {
								description: template('The ${objectName} that was saved.', opts ),
								content: {
									'application/json' : {
										schema : this.schema,
										example : generated
									}
								}
							}
						}
					}
				}))
			});
		});
	}
}, function(opts){
	OutputFormat.call(this, opts);
});

module.exports = Mongonian;