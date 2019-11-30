const express = require('express');
const session = require('cookie-session');
const bodyParser = require('body-parser');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectID = require('mongodb').ObjectID;
const mongourl = "mongodb+srv://kaze:2RmgE3TmtS8qUUGY@cluster0-rhlsu.azure.mongodb.net/test?retryWrites=true&w=majority";
const dbName = "test";
const flash = require('connect-flash');
const fs = require('fs');
const formidable = require('formidable');
const app = express();

app.set('view engine','ejs');

app.use(session({
    name: 'session',
    keys: ['secret']
}));

app.use(flash());
app.use(function(req, res, next) {
	res.locals.success_msg = req.flash('success_msg');
	res.locals.error_msg = req.flash('error_msg');
	res.locals.error = req.flash('error');
	next();
});

const users = new Array(
	{name: 'demo01', password: ''},
	{name: 'demo02', password: ''}
);

//login check middleware
app.use((req,res,next) => {
    if (req.originalUrl == '/login' || req.originalUrl.includes('/api')) {
        return next();
    } else {
        if (!req.session.authenticated && req.originalUrl != '/register') {
            res.redirect('/login');
        }else {
            return next();
        }
    }
});

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({extended:true}));

app.get('/', (req,res) => {
    res.redirect('/restaurants');
});

app.get('/login', (req,res) => {
    res.status(200).render('login.ejs');
});

app.post('/login', (req,res) => {
    users.forEach((user) => {
        if (user.name == req.body.name && user.password == req.body.password) {
            req.session.authenticated = true;
            req.session.username = user.name;
        }
    });
    if (req.session.authenticated != true) {
    	req.flash('error_msg', 'Please enter the correct user name with password');
    	res.redirect('/login');
    } else {
    	res.redirect('/restaurants');
    }
});

app.get('/register', (req,res) => {
	res.status(200).render('register.ejs');
});

app.post('/register', (req,res) => {
	let chkRegister = 0;
	users.forEach((user) => {
        if (user.name == req.body.name) {
        	chkRegister += 1;
        }
    });
	if (chkRegister != 0) {
		chkRegister = 0;
		req.flash('error_msg', 'The user account already exists');
		res.redirect('/register');
	} else {
		chkRegister = 0;
		let newUser = {};
		newUser['name'] = req.body.name;
		newUser['password'] = req.body.password;
		users.push(newUser);
    	req.flash('success_msg', 'You are now registered and can be login');
    	res.redirect('/login');
    }
});

app.get('/restaurants', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end("MongoClient connect() failed!");
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        findRestaurants(db,{},(restaurants) => {
            client.close();
            console.log('Disconnected MongoDB');
            res.render('list.ejs',{username:req.session.username,restaurants:restaurants});
        });
    });
});

app.get('/create', (req,res) => {
    res.render('create.ejs');
    res.end();
});

app.post('/create', (req,res) => {
    const form = new formidable.IncomingForm();
    form.parse(req, (err,fields,files) => {
        let new_r = {};
        new_r['name'] = fields.name;
        new_r['borough'] = fields.borough || '';
        new_r['cuisine'] = fields.cuisine || '';
        new_r['address'] = {};
        new_r['address']['street'] = fields.street || '';
        new_r['address']['building'] = fields.building || '';
        new_r['address']['zipcode'] = fields.zipcode || '';
        new_r['address']['coord'] = [fields.lat || '',fields.long || ''];
        new_r['grades'] = [];
        new_r['owner'] = req.session.username;
        if (files.photo.size == 0) {
            let client = new MongoClient(mongourl);
            client.connect((err) => {
                try {
                    assert.equal(err,null)
                } catch (err) {
                    res.status(500).end("MongoClient connect() failed!");
                }
                const db = client.db(dbName);
                new_r['photo'] = '';
                new_r['photo_mimetype'] = '';
                insertRestaurants(db,new_r,(result) => {
                    client.close();
                    res.redirect('/restaurants');
                });
            });
        } else {
            fs.readFile(files.photo.path, (err,data) => {
                let client = new MongoClient(mongourl);
                client.connect((err) => {
                    try {
                        assert.equal(err,null);
                    } catch (err) {
                        res.status(500).end("MongoClient connect() failed!");
                    }
                    const db = client.db(dbName);
                    new_r['photo'] = new Buffer.from(data).toString('base64');
                    new_r['photo_mimetype'] = files.photo.type;
                    insertRestaurants(db,new_r,(result) => {
                        client.close();
                        res.redirect('/restaurants');
                    });
                });
            });
        }
    });
});

app.get('/search', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end("MongoClient connect() failed!");
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        let criteria = {};
        criteria[req.query.searchBy] = req.query.keyword;
        findRestaurants(db,criteria,(restaurants) => {
            client.close();
            console.log('Disconnected MongoDB');
            res.render('list.ejs',{username:req.session.username,restaurants:restaurants});
        });
    });
})

app.get('/detail', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end("MongoClient connect() failed!");
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        let criteria = {};
        criteria['_id'] = ObjectID(req.query._id);
        findRestaurants(db,criteria,(restaurant) => {
            client.close();
            console.log('Disconnected MongoDB');
            console.log('Restaurant returned = ' + restaurant.length);
            res.render('restaurant.ejs',{restaurant:restaurant,session:req.session});
        });
    });
});

app.get('/map', (req,res) => {
    res.render('map.ejs', {
        lat: req.query.lat,
        lon: req.query.long,
        zoom: 15
    });
    res.end();
});

app.get('/update', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end("MongoClient connect() failed!");
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        let criteria = {};
        criteria['_id'] = ObjectID(req.query._id);
        findRestaurants(db,criteria,(restaurant) => {
            client.close();
            console.log('Disconnected MongoDB');
            console.log('Restaurant returned = ' + restaurant.length);
            res.render('update.ejs',{restaurant:restaurant});
        });
    });
});

app.post('/update', (req,res) => {
    const form = new formidable.IncomingForm();
    form.parse(req, (err,fields,files) => {
        let new_r = {};
        new_r['name'] = fields.name;
        new_r['borough'] = fields.borough || '';
        new_r['cuisine'] = fields.cuisine || '';
        new_r['address'] = {};
        new_r['address']['street'] = fields.street || '';
        new_r['address']['building'] = fields.building || '';
        new_r['address']['zipcode'] = fields.zipcode || '';
        new_r['address']['coord'] = [fields.lat || '',fields.long || ''];
        new_r['owner'] = req.session.username;
        if (files.photo.size == 0) {
            let client = new MongoClient(mongourl);
            client.connect((err) => {
                try {
                    assert.equal(err,null)
                } catch (err) {
                    res.status(500).end("MongoClient connect() failed!");
                }
                const db = client.db(dbName);
                findRestaurants(db,{_id:ObjectID(fields._id)},(restaurant) => {
                    new_r['grades'] = restaurant[0].grades;
                    new_r['photo'] = restaurant[0].photo;
                    new_r['photo_mimetype'] = restaurant[0].photo_mimetype;
                    updateRestaurants(db,fields._id,new_r,(result) => {
                        client.close();
                        res.redirect(`/detail?_id=${fields._id}`);
                    });
                });
            });
        } else {
            fs.readFile(files.photo.path, (err,data) => {
                let client = new MongoClient(mongourl);
                client.connect((err) => {
                    try {
                        assert.equal(err,null);
                    } catch (err) {
                        res.status(500).end("MongoClient connect() failed!");
                    }
                    const db = client.db(dbName);
                    findRestaurants(db,{_id:ObjectID(fields._id)},(restaurant) => {
                        new_r['grades'] = restaurant[0].grades;
                        new_r['photo'] = new Buffer.from(data).toString('base64');
                        new_r['photo_mimetype'] = files.photo.type;
                        updateRestaurants(db,fields._id,new_r,(result) => {
                            client.close();
                            res.redirect(`/detail?_id=${fields._id}`);
                        });
                    });
                });
            });
        }
    });
})

app.get('/delete', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end("MongoClient connect() failed!");
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        let criteria = {};
        criteria['_id'] = ObjectID(req.query._id);
        deleteRestaurants(db,criteria,(restaurant) => {
            client.close();
            console.log('Disconnected MongoDB');
            res.redirect('/restaurants');
        });
    });
});

app.get('/rate', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end("MongoClient connect() failed!");
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        let criteria = {};
        criteria['_id'] = ObjectID(req.query._id);
        findRestaurants(db,criteria,(restaurant) => {
            client.close();
            console.log('Disconnected MongoDB');
            console.log('Restaurant returned = ' + restaurant.length);
            console.log(restaurant[0].grades);
            res.render('rate.ejs',{restaurant:restaurant});
        });
    });
});

app.post('/rate', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end("MongoClient connect() failed!");
        }
        console.log("Connected to MongoDB");
        const db = client.db(dbName);
        let grade = {};
        grade.score = req.body.rating;
        grade.user = req.session.username;
        addRating(db,req.body.r_id,grade,(result) => {
            client.close();
            console.log("Disconnected MongoDB");
            res.redirect(`/detail?_id=${req.body.r_id}`);
        });
    });
});

app.get('/logout', (req,res) => {
    req.session = null;
    res.redirect("/login");
});

app.get('/api/restaurant/:key/:value', (req,res) => {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            res.status(500).end('MongoClient connect() failed!');
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        let criteria = {};
        criteria[req.params.key] = req.params.value;
        findRestaurants(db,criteria,(restaurants) => {
            client.close();
            console.log('Disconnected MongoDB');
            res.status(200).type('json').json(restaurants).end();
        });
    });
});

app.post('/api/restaurant', (req,res) => {
    let new_r = req.body;
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err,null);
        } catch (err) {
            let message = {};
            message.status = "failed";
            res.status(500).type('json').json(message).end();
        }
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        insertRestaurants(db,new_r,(result) => {
            let success = {};
            success.status = "ok";
            success._id = new_r._id;
            res.status(200).type('json').json(success).end();
        });
    });
});

const PORT = process.env.PORT || 8099;
app.listen(PORT, console.log(`Server started on port ${PORT}`));

const findRestaurants = (db,criteria,callback) => {
    const cursor = db.collection("restaurants").find(criteria);
    let restaurants = [];
    cursor.forEach((doc) => {
        restaurants.push(doc);
    }, (err) => {
        assert.equal(err,null);
        callback(restaurants);
    })
};

const insertRestaurants = (db,r,callback) => {
    db.collection('restaurants').insertOne(r,(err,result) => {
        assert.equal(err,null);
        console.log("insert was successful!");
        console.log(JSON.stringify(result));
        callback(result);
    });
};

const updateRestaurants = (db,r_id,doc,callback) => {
    db.collection('restaurants').replaceOne({_id: ObjectID(r_id)},doc,(err,result) => {
        assert.equal(err,null);
        console.log("update was successful");
        console.log(JSON.stringify(result));
        callback(result);
    });
}

const addRating = (db,r_id,grade,callback) => {
    db.collection('restaurants').updateOne({_id: ObjectID(r_id)},{$push:{grades:grade}},(err,result) => {
        assert.equal(err,null);
        console.log("rating added successfully");
        console.log(JSON.stringify(result));
        callback(result);
    })
}

const deleteRestaurants = (db,r,callback) => {
    db.collection('restaurants').deleteOne(r,(err,result) => {
        assert.equal(err,null);
        console.log("delete was successful");
        console.log(JSON.stringify(result));
        callback(result);
    })
}