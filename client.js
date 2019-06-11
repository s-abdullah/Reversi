const socketio = io('http://localhost:8000', {
    query: 'ABDULLAH',
})



const length = 64
const zero = 0
const two = 2
const one = 1
let username = null


socketio.on('username', () => {
    console.log('Following username is sent: ' + username)
    socketio.emit('username', username)
})

socketio.on('lowlight', () => {
    for (let i = zero; i < length; i++) {
        const id = 'm' + i
        document.getElementById(id).style.background = '#ffffff'
    }
})

socketio.on('highlight', data => {
    data.forEach((i) => {
        const id = 'm' + i
        document.getElementById(id).style.background = '#f0f000'
    })
})


socketio.on('End', data => {
    const score = scorekeeper(data)
    if (score[zero] > score[one]) {
        document.getElementById('info').innerHTML = 'You Win'
    } else if (score[zero] < score[one]) {
        document.getElementById('info').innerHTML = 'You Lose'
    } else {
        document.getElementById('info').innerHTML = 'StaleMate'
    }
})

socketio.on('connect', () => console.log('connected to server'))

socketio.on('disconnect', () => console.log('disconnected from server'))

socketio.on('Possible', data => {
    document.getElementById('possible').innerHTML = 'Possible Moves: ' + data
})

socketio.on('Message', data => {
    console.log('NAME: ' + username)
    if (username === null) {
        console.log('I AM USER NUMBER: ' + data % two)
        username = data
    }
    if (username % two === zero) {
        // $('#piece').append('Your Piece: O')
        document.getElementById('piece').innerHTML = 'Your Piece: X'
    } else {
        // $('#piece').append('Your Piece: X')
        document.getElementById('piece').innerHTML = 'Your Piece: O'
    }
    document.getElementById('score1').innerHTML = 'Your Score: ' + two
    document.getElementById('score2').innerHTML = 'Opponent Score: ' + two
})

socketio.on('player_move', data => {
    for (let i = zero; i < length; i++) {
        const id = 'm' + i
        if (data[i] === username) {
            // document.getElementById(id).style.background = '#ffffff'
            if (username % two === zero) {
                document.getElementById(id).innerHTML = 'X'
            } else {
                document.getElementById(id).innerHTML = 'O'
            }
        } else if (data[i] !== zero) {
            if (username % two === zero) {
                document.getElementById(id).innerHTML = 'O'
            } else {
                document.getElementById(id).innerHTML = 'X'
            }
        }
    }
    scorekeeper(data)
})

socketio.on('turner', data => {
    document.getElementById('info').innerHTML = data
})

move() // gives undefined since no arguments passed but needed for eslint
function move(name) {
    const condition = document.getElementById('info').innerHTML
    if (condition === 'Your Move' || condition === 'Invalid Move!') {
        socketio.emit('player_move', name)
    }
}

function scorekeeper(board) {
    let me = 0
    let you = 0
    for (let i = zero; i < length; i++) {
        if (board[i] === username) {
            me++
        } else if (board[i] !== zero) {
            you++
        }
    }
    document.getElementById('score1').innerHTML = 'Your Score: ' + me
    document.getElementById('score2').innerHTML = 'Opponent Score: ' + you
    return [me, you]
}
