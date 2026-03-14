// Shared Socket.IO instance — set from server.js, used by controllers
let io = null;

module.exports = {
    setIO: (ioInstance) => { io = ioInstance; },
    getIO: () => io,
};
