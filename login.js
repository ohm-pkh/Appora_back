import pool from "./db.js"
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import SibApiV3Sdk from 'sib-api-v3-sdk';



const JWT_SECRET = process.env.JWT_SECRET;
const MAIL_PASS = process.env.Appora_pass;

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications['api-key'];
apiKey.apiKey = MAIL_PASS

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

export const Send_Email = async (text, email, title) => {
  const sendSmtpEmail = {
    to: [{ email: email }],
    sender: { email: 'appora.wgad@gmail.com', name: 'Appora' }, // VERIFIED sender
    subject: title,
    htmlContent: text,
  };

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Email sent successfully to", email);
    return 1;
  } catch (err) {
    if (err.response && err.response.body) {
      console.error("Send email failed:", err.response.body);
    } else {
      console.error("Send email failed:", err);
    }
    return 0;
  }
};

//Create random 6 digit validation code
function generateRandom6DigitNumber() {
  return Math.floor(100000 + Math.random() * 900000);
}

//Hash password
const Hash_Password = (pass) => {
  return bcrypt.hash(pass, 10);
}
//Compare Hash password
const Compare_Hash = (pass, H_pass) => {
  return bcrypt.compare(pass, H_pass);
}


//Create Account
export const Register = async (req, res) => {
  try {
    //Get user_Info
    const {
      email,
      password,
      role
    } = req.body;
    //Hash password
    const hashed_pass = await Hash_Password(password);
    //Set status
    const acc_status = role === "User" ? "Complete" : "Pending";

    const Loweremail = email.toLowerCase();
    //Create user account in db
    const NewUser = await pool.query(
      `INSERT INTO account (email, password, role , acc_status ) VALUES ($1, $2, $3, $4) RETURNING id;`,
      [Loweremail, hashed_pass, role, acc_status]
    );

    //Create userInfo for UID
    const user = NewUser.rows[0];

    if (role === "Restaurant") {
      //Create verification code
      const V_Code = generateRandom6DigitNumber();
      //Hashed the verification code
      const VC_Hashed = await Hash_Password(V_Code.toString());
      const type = 'Verify_res';
      const Vid = await pool.query(
        `INSERT INTO validation_code (uid, code, type)
   VALUES ($1, $2, $3)
   ON CONFLICT (uid) DO UPDATE 
   SET code = EXCLUDED.code, expire_time = DEFAULT
   WHERE validation_code.type = EXCLUDED.type
   RETURNING uid;`,
        [user.id, VC_Hashed, type]
      );
      //Send Validate code to Restaurant
      const email_subject = `Appora verify Code`;
      const email_body = `Here’s your verification code:

${V_Code}

Please enter this code in the app to verify your account.
This code will expire in 15 minutes.
.

Best regards,
The Appora Team`;
      const Sender = await Send_Email(email_body, email, email_subject);
      if (!Sender) {
        throw new Error("Send email Fail!");
      }
      //return uid from vcode
      return res.status(200).json({
        uid: Vid.rows[0].uid,
        // user: NewUser.rows[0]
        message: "User created with verification code",
      });
    }
    // Send welcome email to new user.
    const email_subject = `Welcome to Appora`;
    const email_body = `Your account has been successfully created. We’re excited to have you on board!
      You can now log in to your account using your registered email address.`;
    const Sender = await Send_Email(email_body, email, email_subject);
    if (!Sender) {
      throw new Error("Send email Fail!");
    }

    //Return userinfo in json form
    res
      .status(200)
      .json({
        user_id: NewUser.rows[0],
        message: "User Created"
      });
  } catch (err) {
    console.log(err.message);
    res.status(500).send({
      message: "Internal server error"
    })
    throw (err);
  }
}


//Login
export const Login = async (req, res) => {
  try {
    //Get info from frontend
    const {
      email,
      password
    } = req.body;
    const Loweremail = email.toLowerCase();
    //Get userInfo
    const UserResult = await pool.query(
      "SELECT id, password, role, acc_status FROM account WHERE email = $1",
      [Loweremail]
    );

    //If no user with specific email
    if (UserResult.rows.count === 0) {
      res.status(401).send({
        error: "Invalid information"
      });
    }

    //Create data from info
    const user = UserResult.rows[0];

    if (user.acc_status === "Pending") {
      return res.status(403).send({
        id: user.id,
        message: "Account not verify"
      });
    }

    //Compare hashed password with inputted password 
    const isMatch = await Compare_Hash(password, user.password);
    if (!isMatch) {
      return res.status(401).send({
        message: "Invalid email or password"
      });
    }

    //Create JWT
    const token = jwt.sign({
        id: user.id,
      },
      JWT_SECRET, {
        expiresIn: "7d"
      }
    );

    //Send Response
    res.status(200).json({
      token: token,
      role: user.role
    });
  } catch (err) {
    console.log(err.message);
    res.status(500).send({
      message: "Internal server error"
    });
  }
}

export const CheckAuth = async (req, res) => {
  try {
    const token = req.query.token;
    const verified = jwt.verify(token, JWT_SECRET);
    const Result = await pool.query('SELECT role FROM account WHERE id = $1', [verified.id]);
    if (Result.rows.count === 0) {
      res.status(401).send({
        error: "Invalid information"
      });
    }
    const row = Result.rows[0];
    res.status(200).json({
      role: row.role
    });
  } catch (err) {
    console.log(err);
    res.status(401).send({
      message: 'Unauthorized',
    })
  }
}

export const Verify = async (req, res) => {
  try {
    //Get input
    const {
      Verifycode,
      email,
      type
    } = req.body;

    if (!Verifycode) {
      return res.status(400).send({
        message: 'Verify Code not found'
      })
    }
    const Loweremail = email.toLowerCase();
    const result = await pool.query(
      `SELECT vc.uid, vc.code 
       FROM validation_code vc 
       JOIN account a ON vc.uid = a.id 
       WHERE a.email = $1 and vc.type = $2`,
      [Loweremail, type]
    );
    //If not found 
    if (result.rows.length === 0) {
      res.status(401).send({
        error: "Invalid Verified code"
      });
    }
    //Get vcode
    const Rest_data = result.rows[0];
    //Compare Vcode
    const isMatch = await bcrypt.compare(Verifycode, Rest_data.code);
    //If not matched 
    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid verification code"
      });
    }
    //Update status
    const Verify = await pool.query("UPDATE account SET acc_status = 'Complete' WHERE id = $1", [Rest_data.uid]);
    //Delete Data
    const Del_VC = await pool.query(
      "DELETE FROM validation_code WHERE uid = $1 RETURNING uid",
      [Rest_data.uid]
    );

    console.log(`uid: ${Del_VC.rows[0].uid} Complete verify.`);
    if (type === 'Recovery') {
      const token = jwt.sign({
          id: Del_VC.rows[0].uid,
          status: 'Verified',
        },
        JWT_SECRET, {
          expiresIn: "1d"
        }
      );
      return res.status(200).json({
        success: true,
        token: token,
      });
    }
    res.status(200).json({
      success: true,
      uid: Del_VC.rows[0].uid,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: "Internal server error",
      message: "Internal Error."
    });
  }
}

// export const Forgot_Pass = async (req, res) => {
//   try {
//     //Get user email
//     const email = req.query.email;
//     // const {email, type} = req.body;
//     const type = "Recovery";
//     //Create Validation code
//     const V_Code = generateRandom6DigitNumber();
//     //Hashed the verification code
//     const VC_Hashed = await Hash_Password(V_Code);
//     // Insert into value
//     const Vid = await pool.query(
//       `INSERT INTO validation_code (uid, code, type)
//    VALUES ((SELECT id from account where email = $1), $2, $3)
//    ON CONFLICT (uid) DO UPDATE 
//    SET code = EXCLUDED.code, expire_time = DEFAULT
//    WHERE validation_code.type = EXCLUDED.type
//    RETURNING uid;`,
//       [email, VC_Hashed, type]
//     );
//     if (result.rows.length === 0) {
//       // means conflict happened but WHERE condition failed
//       console.log("No insert/update done — condition didn't match");
//       return res.status(403).send({
//         message: "Account not verify"
//       });
//     }
//     //Convert code to string
//     const code = V_Code.toString()
//     //Text for sending email
//     const text = `We received a request to reset your password.
// Please use the verification code below to proceed:

// ${code}

// This code will expire in 10 minutes for security reasons.
// If you didn’t request a password reset, you can safely ignore this email — your account will remain secure.

// Thank you,
// The Appora Team`;
//     const email_subject = `Appora verify Code`;
//     //Create sender and send email
//     const Sender = await Send_Email(text, email, email_subject);
//     if (Sender) {
//       res.status(200).send({
//         message: "Email Sended"
//       });
//     } else {
//       res.status(401).send({
//         message: "Failed to send email"
//       });
//     }

//   } catch (error) {
//     console.log(error.message);
//     res.status(500).send({
//       error: "Internal server error"
//     });
//   }
// }

export const Reset_Pass = async (req, res) => {
  try {
    //Get input
    const {
      token,
      password
    } = req.body;
    // const { password, email, Verifycode } = req.body; 

    //If need to verify
    const hashed_pass = await Hash_Password(password);
    const verified = jwt.verify(token, JWT_SECRET);
    if (!verified.status) {
      throw new Error(401).send({
        message: "status not found",
      });
    }
    //Only reset
    const Repass = await pool.query(
      "UPDATE account SET password = $1 WHERE id = $2 RETURNING *;",
      [hashed_pass, verified.id]
    );
    res.status(200).json({
      success: true
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send({
      message: "Internal server error"
    })
  }
}

export const Resend_code = async (req, res) => {
  try {
    const email = req.query.email;
    const type = req.query.type;
    const Loweremail = email.toLowerCase();
    const V_Code = generateRandom6DigitNumber();
    //Hashed the verification code
    const VC_Hashed = await Hash_Password(V_Code.toString());
    console.log(email);
    const Vid = await pool.query(
      `INSERT INTO validation_code (uid, code, type)
   VALUES ((SELECT id from account where email = $1), $2, $3)
   ON CONFLICT (uid) DO UPDATE 
   SET code = EXCLUDED.code, expire_time = DEFAULT
   WHERE validation_code.type = EXCLUDED.type
   RETURNING uid;`,
      [Loweremail, VC_Hashed, type]
    );
    const email_subject = `Appora verify Code`;
    const email_body = `Here’s your verification code${type === 'Recovery'? '(Recovery Password)':''}:

${V_Code}

Please enter this code in the app to verify your account.
This code will expire in 15 minutes.
.

Best regards,
The Appora Team`;
    const Sender = await Send_Email(email_body, email, email_subject);
    if (!Sender) {
      throw new Error("Send email Fail!");
    }
    //return uid from vcode
    return res.status(200).json({
      uid: Vid.rows[0].uid,
      // user: NewUser.rows[0]
      message: "User created with verification code",
    });
  } catch (err) {
    console.log(err.message);
    res.status(500).send({
      message: "Internal server error"
    })
    throw (err);
  }

}

export const Check_email = async (req, res) => {
  try {
    const email = req.query.email;
    const Loweremail = email.toLowerCase();
    console.log(email);
    const Result = await pool.query(`SELECT acc_status FROM account WHERE email = $1`, [Loweremail]);
    const row = Result.rows[0];
    if (row.acc_status !== "Complete") {
      return res.status(403).send({
        message: "Account not verify."
      });
    }
    const type = 'Recovery';
    const V_Code = generateRandom6DigitNumber();
    //Hashed the verification code
    const VC_Hashed = await Hash_Password(V_Code.toString());
    const Vid = await pool.query(
      `INSERT INTO validation_code (uid, code, type)
   VALUES ((SELECT id from account where email = $1), $2, $3)
   ON CONFLICT (uid) DO UPDATE 
   SET code = EXCLUDED.code, expire_time = DEFAULT
   WHERE validation_code.type = EXCLUDED.type
   RETURNING uid;`,
      [Loweremail, VC_Hashed, type]
    );
    const email_subject = `Appora verify Code`;
    const email_body = `Here’s your verification code${type === 'Recovery'? '(Recovery Password)':''}:

${V_Code}

Please enter this code in the app to verify your account.
This code will expire in 15 minutes.
.

Best regards,
The Appora Team`;
    const Sender = await Send_Email(email_body, email, email_subject);
    if (!Sender) {
      throw new Error("Send email Fail!");
    }
    //return uid from vcode
    return res.status(200).json({
      success: true,
      // user: NewUser.rows[0]
      message: "User created with verification code",
    });
  } catch (err) {
    console.log(err);
    res.status(404).send({
      message: 'Email not found'
    });
  }
}