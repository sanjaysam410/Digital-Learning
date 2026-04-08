const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
    console.log("Connecting...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected.");
    const OTP = require('./models/OTP');
    console.log("Finding...");
    const res1 = await OTP.findOne({ email: 'test@test.com' });
    console.log("Find done:", res1);
    console.log("Creating/Updating...");
    const res2 = await OTP.findOneAndUpdate(
        { email: 'test@test.com' },
        { email: 'test@test.com', otp: '123456' },
        { upsert: true, new: true }
    );
    console.log("Update done:", res2);
    process.exit(0);
}
test().catch(err => {
    console.error(err);
    process.exit(1);
});
