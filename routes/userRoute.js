import express from "express";
const router = express.Router();
import axios from "axios";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import moment from "moment";
import { Buffer } from "buffer";
import User from "../models/userModel.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import Doctor from "../models/doctorModel.js";
import Appointment from "../models/appointmentModel.js";

const consumerKey = process.env.MPESA_CONSUMER_KEY;
const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
const passKey = process.env.MPESA_PASS_KEY;
const businessShortCode = 174379;

const generateAccessToken = async () => {
  try {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
      "base64"
    );
    const response = await fetch(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const token = data.access_token;
      console.log("The token from the fucking response ::::", data);

      console.log("Access Token Response:", token);
      return token; // Return the access token
    } else {
      console.log("error ", response);
    }
  } catch (error) {
    console.error(
      "Error generating access token:",
      error.response?.data || error.message
    );
    throw error;
  }
};
router.post("/payment-request", async (req, res) => {
  try {
    // const { phoneNumber, amount } = req.body;

    console.log("Log the entire request:::", req);
    // if (!phoneNumber || !amount) {
    //   return res
    //     .status(400)
    //     .json({ error: "Phone number and amount are required" });
    // }

    const accessToken = await generateAccessToken();
    console.log("Access token in the route :", accessToken);
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .split(".")[0];
    const password = Buffer.from(
      `${businessShortCode}${passKey}${timestamp}`
    ).toString("base64");

    const requestData = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: 1,
      PartyA: "254768548261",
      PartyB: businessShortCode,
      PhoneNumber: "254768548261",
      CallBackURL: "https://8546-41-139-250-173.ngrok-free.app",
      AccountReference: "TestPayment",
      TransactionDesc: "Payment for order #123",
    };

    const stkResponse = await fetch(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      }
    );

    const responseText = await stkResponse.text();

    if (stkResponse.ok) {
      console.log("STK Push Response:", responseText);
    } else {
      console.error("error in stkresponse",responseText)
    } 

    const responseData = await stkResponse.json();
    res.json(responseData);
  } catch (error) {
    console.error("STK Push Error:", error.message);
    res.status(500).json({ error: "STK Push failed" });
  }
});



router.post("/register", async (req, res) => {
  try {
    const userExists = await User.findOne({ email: req.body.email });

    if (userExists) {
      return res
        .status(400)
        .send({ message: "User already exists", success: false });
    }
    const password = req.body.password;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    req.body.password = hashedPassword;

    const newUser = new User(req.body);

    await newUser.save(); //saves document in mongodb
    res.status(200).send({ message: "User created succefully", success: true });
  } catch (error) {
    res.status(500).send({ message: "Error creating user", success: false });
  }
});

router.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res
        .status(404)
        .send({ message: "User does not exist", success: false });
    }
    const isMatch = await bcrypt.compare(req.body.password, user.password); //compares encrypted password
    console.log(isMatch);
    if (!isMatch) {
      res
        .status(200)
        .send({ message: "Password is incorrect", success: false });
    } else {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });
      res
        .status(200)
        .send({ message: "Login Successful", success: true, data: token });
    }
  } catch (error) {
    console.log("Displaying login errors :", error);
    res.status(500).send({ message: "Error logging in", success: false });
  }
});

router.post("/get-user-by-id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.body.userId });
    user.password = undefined;
    console.log(user);
    if (!user) {
      req.status(404).send({ message: "User does not exist", success: false });
    } else {
      res.status(200).send({
        success: true,
        data: {
          ...user,
        },
      });
    }
  } catch (error) {
    res
      .status(500)
      .send({ message: "User info not found", success: false, error });
  }
});

router.post("/update-user-profile", authMiddleware, async (req, res) => {
  try {
    const password = req.body.password;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    req.body.password = hashedPassword;

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: req.body.userId,
      },
      req.body,
      { new: true } //Returns the updated document
    );
    res.status(200).send({
      success: true,
      message: "User profile updated successfully",
      data: updatedUser,
    });
    console.log("Upated user details : ", updatedUser);
  } catch (error) {
    console.log("Update profile error is : ", error);
    res.status(500).send({
      message: "Error updating user profile",
      success: false,
      error,
    });
  }
});

router.post("/apply-doctor-account", authMiddleware, async (req, res) => {
  try {
    const newDoctor = new Doctor({ ...req.body, status: "pending" });
    await newDoctor.save();
    const adminUser = await User.findOne({ isAdmin: true });
    console.log("Showing new doctor ", newDoctor);

    const unseenNotifications = adminUser.unseenNotifications;
    unseenNotifications.push({
      type: "new-doctor-request",
      message: `${newDoctor.firstName} ${newDoctor.lastName} has applied for doctor account`,
      data: {
        doctorId: newDoctor._id,
        name: newDoctor.firstName + " " + newDoctor.lastName,
      },
      onClickPath: "/admin/doctorslist",
    });
    await User.findByIdAndUpdate(adminUser._id, { unseenNotifications });
    res.status(200).send({
      success: true,
      message: "Doctor account applied successfully",
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .send({ message: "Error applying for doctor account", success: false });
  }
});

router.post(
  "/mark-all-notifications-as-seen",
  authMiddleware,
  async (req, res) => {
    try {
      const user = await User.findOne({ _id: req.body.userId });
      const unseenNotifications = user._doc.unseenNotifications;
      const seenNotifications = user._doc.seenNotifications;
      seenNotifications.push(...unseenNotifications);
      user.unseenNotifications = [];
      user.seenNotifications = seenNotifications;
      const updatedUser = await user.save();
      updatedUser.password = undefined;

      res.status(200).send({
        success: true,
        message: "All notifications marked as seen",
      });
    } catch (error) {
      console.log(error);
      res
        .status(500)
        .send({ message: "Error clearing notifications", success: false });
    }
  }
);

router.post("/delete-all-notifications", authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.body.userId });
    const unseenNotifications = user._doc.unseenNotifications;
    user.seenNotifications = [];
    user.unseenNotifications = [];

    const updatedUser = await user.save();
    updatedUser.password = undefined;

    res.status(200).send({
      success: true,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .send({ message: "Error clearing notifications", success: false });
  }
});

router.get("/get-all-approved-doctors", async (req, res) => {
  try {
    const doctors = await Doctor.find({ status: "approved" });
    res.status(200).send({
      message: "Doctors fetched successfully",
      success: true,
      data: doctors,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "Error fetching doctors",
      success: false,
    });
  }
});

router.post("/book-appointment", authMiddleware, async (req, res) => {
  try {
    req.body.status = "pending";
    const newAppointment = new Appointment(req.body);
    await newAppointment.save();
    //pushing notification to doctor based on his userid
    const user = await User.findOne({ _id: req.body.doctorInfo.userId });
    user.unseenNotifications.push({
      type: "new-appointment-request",
      message: `${req.body.userInfo._doc.name} has sent an appointment request `,
      onClickPath: "/doctor/appointments",
    });
    await user.save();
    res.status(200).send({
      message: "Appointment booked successfully",
      success: true,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "Error booking appointment",
      success: false,
      error,
    });
  }
});

router.post("/check-booking-avilability", authMiddleware, async (req, res) => {
  try {
    const date = moment(req.body.date, "DD-MM-YYYY").toISOString();
    const fromTime = moment(req.body.time, "HH:mm")
      .subtract(1, "hours")
      .toISOString();
    const toTime = moment(req.body.time, "HH:mm").add(1, "hours").toISOString();
    const doctorId = req.body.doctorId;
    const appointments = await Appointment.find({
      doctorId,
      date,
      time: { $gte: fromTime, $lte: toTime },
    });
    if (appointments.length > 0) {
      return res.status(200).send({
        message: "Appointments not available",
        success: false,
      });
    } else {
      return res.status(200).send({
        message: "Appointments available",
        success: true,
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "Error booking appointment",
      success: false,
      error,
    });
  }
});

router.get("/get-appointments-by-user-id", authMiddleware, async (req, res) => {
  try {
    const appointments = await Appointment.find({ userId: req.body.userId });
    res.status(200).send({
      message: "Appointments fetched successfully",
      success: true,
      data: appointments,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "Error fetching appointments",
      success: false,
      error,
    });
  }
});

// module.exports = router;
export default router;
