'use strict'
const http = require('http')
const fs = require('fs')
const jade = require('jade')
const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://localhost:27017/reversi'
//VARIABLE DECLARATIONS!
// array for current active users
const active = []
//arrray for the connected users that are waiting
const CLIENTS = []
const RECON = []

// let restart = null

const length = 64
const zero = 0
const one = 1
const eight = 8
const nine = 9
const seven = 7
// const eleven = 11
// e,w,n,s,sw,ne,se,nw
const direction = [one, -one, eight, -eight, seven, -seven, nine, -nine]

// const two = 2
const t7 = 27
const t8 = 28
const t5 = 35
const t6 = 36
//number of user and aslo id assigner
let users = null
//MongoDB variables
let pth = null
let total = null
// let database = null
let userP = null
// let initialP = null
// const totalID = null

const port = 8000

const server = http.createServer((request, response) => {
    if (request.url === '/client.js') {
        fs.readFile('client.js', 'utf-8', (err, data) => {
            console.log('sending client.js')
            response.end(data)
        })
    } else {
        fs.readFile('client.jade', 'utf-8', (err, data) => {
            console.log('sending client.html')
            response.end(jade.compile(data)())
        })
    }
})
const io = require('socket.io')(server)

// Opening Server
server.listen(port, () => {
    console.log('listening at http://localhost:8000')
})

// Opening Coneection with MongoDB
MongoClient.connect(url, (err, db) => {
    if (err) {
        console.log('Unable to connect to the MongoDB server. Error: ', err)
    } else {
        console.log('Connection established to', url)
        // database = db
        pth = db.collection('users')
        total = db.collection('total')
        dbchecker()
    }
})

//function to check if there is alreaady data in our database
function dbchecker() {
    return new Promise((resolve, reject) => {
        pth.count((err, count) => {
            if (!err && count === zero) {
                console.log('NEW START')
                users = zero
                total.insert({'totalUsers' : zero})
                resolve(users)
            } else if (!err && count > zero) {
                console.log('RESTART')
                total.find({'totalUsers':{$gte:0}}).toArray((err, result) => {
                    if (err) {
                        console.log(err)
                        reject(err)
                    } else if (result.length) {
                        console.log('Found:', result[zero].totalUsers)
                        users = result[zero].totalUsers
                        resolve(users)
                    } else {
                        reject('No document found with "find" criteria!')
                    }
                })
                console.log(users)
                pth.find().toArray((err, data) => {
                    data.forEach((game) => {
                        RECON.push({
                            user1: game.user1,
                            user2: game.user2,
                            board: game.board,
                            flag1: zero,
                            flag2: zero,
                            con1: null,
                            con2: null,
                        })
                    })
                })
            } else {
                console.log(err)
                // process.exit()
            }
        })
    })
}

function updateDB(path, name, value, u1, u2, newB) {
    // return new Promise((resolve, reject) => {
    const query = {}
    query[name] = value
    path.update(query, {'user1': u1.name, 'user2': u2.name, 'board': newB})
}

// function idFinder(path, name, val) {
//     return new Promise((resolve, reject) => {
//         const query = {}
//         query[name] = val
//         path.find(query).toArray((err, result) => {
//             if (err) {
//                 console.log(err)
//                 reject(err)
//             } else if (result.length) {
//                 console.log('Found:', result[zero]._id)
//                 console.log('Found:', result[zero].totalUsers)
//                 resolve(result[zero]._id)
//             } else {
//                 reject('No document found with "find" criteria!')
//             }
//         })
//     })
// }
io.sockets.on('connection', socket => {
    console.log('TRYING TO CONNECT')
    // initialP = dbchecker()
    userP = promiseuser(socket)
    userP.then((username) => {
        if (username === null || username === undefined) {
            users++
            total.update({'totalUsers': {$gte:0}}, {'totalUsers': users})
            socket.emit('Message', users)
            // console.log('NEW User Connected-ID alloted: ' + users)
            CLIENTS.push({
                conn: socket,
                name: users,
            })
            socket.emit('turner', 'Waiting For Player')
            activate()
        } else {
            // console.log('An Existing User REconnected with ID:' + username)
            RECON.forEach((game) => {
                if (game.user1 === username) {
                    game.flag1 = one
                    game.con1 = socket
                } else if (game.user2 === username) {
                    game.flag2 = one
                    game.con2 = socket
                }
            })
            reactivate()
        }
    })


    socket.on('disconnect', () => {
        active.forEach((game, index) => {
            if (game.user1.conn === socket) {
                game.user2.conn.emit('turner', 'Session Ended!')
                game.user2.conn.disconnect()
                active.splice(index, one)
                pth.remove({'user1': game.user1.name})
            } else if (game.user2.conn === socket) {
                game.user1.conn.emit('turner', 'Session Ended!')
                game.user1.conn.disconnect()
                active.splice(index, one)
                pth.remove({'user2': game.user2.name})
            }
            // update db
        })
        CLIENTS.forEach((user, index) => {
            if (user.conn === socket) {
                CLIENTS.splice(index, one)
                // users--
            }
        })
        console.log('user disconnected')
        //MongoDB remove the client here
    })

    socket.on('player_move', data => {
        console.log('Message Received!' + data)
        active.forEach((game) => {
            if (game.user1.conn === socket) {
                mover(game.user1, game.user2, game, data)
            } else if (game.user2.conn === socket) {
                mover(game.user2, game.user1, game, data)
            }
        })
    })
})
// }
//function Decalarations start here
//function for activating a match
function activate() {
    if (CLIENTS.length > one) {
        const user1 = CLIENTS.shift()
        const user2 = CLIENTS.shift()
        const array = grider(user1.name, user2.name)
        active.push({
            user1: user1,
            user2: user2,
            board: array,
        })
        possible(user2, user1, array)
        user2.conn.emit('turner', 'Your Move')
        possible(user1, user2, array)
        user1.conn.emit('turner', 'Opponent\'s Move')
        // MongoDB INSERT NEW DOCUMENT HERE
        pth.insert({'user1': user1.name, 'user2': user2.name, 'board': array})
    }
}

function reactivate() {
    RECON.forEach((game, index) => {
        if (game.flag1 === one && game.flag2 === one) {
            active.push({
                user1: {name: game.user1, conn: game.con1},
                user2: {name: game.user2, conn: game.con2},
                board: game.board,
            })
            RECON.splice(index, one)
        }
    })
}

//funciton grider returns an array object that
//corresponds to each match being played
function grider(x, y) {
    const array = []
    for (let i = 0; i < length; i++) {
        if (i === t7 || i === t6) {
            array.push(x)
        } else if (i === t8 || i === t5) {
            array.push(y)
        } else {
            array.push(zero)
        }
    }
    return array
}

//checks validates the move and sends updated board to clients
function mover(user1, user2, object, move) {
    if (object.board[move] === zero) {
        if (checker(move, user1, user2, object.board) === eight) {
            notlegal(user1.conn)
        } else {
            user2.conn.emit('player_move', object.board)
            user1.conn.emit('player_move', object.board)
            updateDB(pth, 'user1', user1.name, user1, user2, object.board)
            updateDB(pth, 'user2', user1.name, user1, user2, object.board)
            // const x = possible(user1, user2, object.board)
            // const y = possible(user2, user1, object.board)
            stupidEslint(user1, user2, object.board)
            // if (x > zero && y > zero) {
            //     user1.conn.emit('turner', 'Opponent\'s Move')
            //     user2.conn.emit('turner', 'Your Move')
            // } else if (x === zero && y === zero) {
            //     user1.conn.emit('End', object.board)
            //     user2.conn.emit('End', object.board)
            // } else if (x === zero) {
            //     user1.conn.emit('turner', 'No Valid Moves')
            //     user2.conn.emit('turner', 'Your Move')
            // } else {
            //     user1.conn.emit('turner', 'Your Move')
            //     user2.conn.emit('turner', 'No Valid Moves')
            // }
        }
    } else {
        notlegal(user1.conn)
    }
}

function stupidEslint(user1, user2, board) {
    const x = possible(user1, user2, board)
    // const y = possible(user2, user1, board)
    if (x > zero && possible(user2, user1, board) > zero) {
        user1.conn.emit('turner', 'Opponent\'s Move')
        user2.conn.emit('turner', 'Your Move')
    } else if (x === zero && possible(user2, user1, board) === zero) {
        user1.conn.emit('End', board)
        user2.conn.emit('End', board)
    } else if (x === zero) {
        user1.conn.emit('turner', 'No Valid Moves')
        user2.conn.emit('turner', 'Your Move')
    } else {
        user1.conn.emit('turner', 'Your Move')
        user2.conn.emit('turner', 'No Valid Moves')
    }
}

// checks the validity of the moves
function checker(pos, user1, user2, board) {
    let moves = pos
    let counter = zero
    direction.forEach((offset) => {
        moves = pos
        if (limit(offset, moves)) {
            moves = pos + offset
            while (board[moves] === user2.name && limit(offset, moves)) {
                moves = moves + offset
            }
            if (board[moves] === user1.name && moves - offset !== pos) {
                changer(user1, user2, pos, moves, offset, board)
            } else {
                counter++
            }
        } else {
            counter++
        }
    })
    return counter
}

// checks to see the limits of the move in context of the board
function limit(offset, position) {
    // console.log(position);
    if (offset > zero) {
        if (offset === one) {
            // console.log('ONE');
            return position % eight !== seven
        } else if (offset === seven) {
            // console.log('SEVEN');
            // console.log(position % eight);
            // console.log(position >= eight);
            return position % eight !== zero && position < length - eight
        } else if (offset === eight) {
            // console.log('EIGHT');
            return position < length - eight
        }
        return position % eight !== seven && position < length - eight
    } else if (offset === -one) {
        // console.log('MINUS ONE');
        return position % eight !== zero
    } else if (offset === -seven) {
        // console.log('MINUS SEVEN');
        // console.log(position % eight);
        // console.log(position >= eight);
        return position % eight !== seven && position >= eight
    } else if (offset === -eight) {
        // console.log('MINUS EIGHT');
        return position >= eight
    }
    // console.log('MINUS nine');
    // console.log(position % eight);
    // console.log(position >= eight);
    return position % eight !== zero && position >= eight
}

// tels client the move is illegal
function notlegal(connection) {
    connection.emit('turner', 'Invalid Move!')
}

// changes the board accrding to the valid move
function changer(user1, user2, init, final, offset, board) {
    let initial = init
    while (initial !== final) {
        board[initial] = user1.name
        initial = initial + offset
    }
    board[final] = user1.name
}

// checks the board for all possible moves of the current player
function possible(user1, user2, board) {
    let moves = zero
    let counter = zero
    const high = []
    for (let i = zero; i < length; i++) {
        if (board[i] === zero) {
            direction.forEach((off) => {
                if (limit(off, i)) {
                    moves = i + off
                    while (board[moves] === user2.name && limit(off, moves)) {
                        moves = moves + off
                    }
                    if (board[moves] === user1.name && moves - off !== i) {
                        counter++
                        high.push(i)
                    }
                }
            })
        }
    }
    user1.conn.emit('lowlight')
    user1.conn.emit('highlight', high)
    user1.conn.emit('Possible', counter)
    return counter
}

// function getusername(con) {
//     console.log('sending request')
//     con.emit('username')
//     console.log('receiveing request')
//     var prom = promiseuser(con)
//     prom.then((data) => {
//         console.log('NUMNER: [][][][]' + data)
//         return data
//     })
//     // let returneee = null
//     // con.on('username', data => {
//     //     returneee = data
//     //     console.log('NUMNER: [][][][]' + data)
//     // })
//     // console.log('///////' + returneee)
//     // return returneee
// }

function promiseuser(socket) {
    return new Promise((resolve, reject) => {
        socket.emit('username')
        socket.on('username', (data) => {
            if (data < zero) {
                reject('Invalid')
            } else {
                resolve(data)
            }
        })
    })
}
