const functions = require('firebase-functions');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
   const admin = require('firebase-admin');
   const path = require('path');
   const fs = require('fs');

   // Initialize Firebase Admin if not already initialized
   if (admin.apps.length === 0) {
       admin.initializeApp();
   }

   exports.serveAdmin = functions.https.onRequest(async (req, res) => {
       const idToken = req.headers.authorization?.split('Bearer ')[1];

       if (!idToken) {
           // No token, redirect to login
           res.redirect('/account.html');
           return;
       }

       try {
           const decodedToken = await admin.auth().verifyIdToken(idToken);
           const uid = decodedToken.uid;

           // Replace with your actual admin UID
           const adminUid = '8kGKHeMUAeXynvGA75lhODvOJ7L2'; 

           if (uid === adminUid) {
               // Admin user, serve the admin page
               const adminPath = path.join(__dirname, '../public/admin.html');
               fs.readFile(adminPath, (err, data) => {
                   if (err) {
                       console.error('Error reading admin.html:', err);
                       res.status(500).send('Error loading admin page.');
                   } else {
                       res.status(200).send(data);
                   }
               });
           } else {
               // Not admin, redirect to account page
               res.redirect('/account.html');
           }

       } catch (error) {
           console.error('Error verifying token:', error);
           res.redirect('/account.html');
       }
   });

admin.initializeApp(); // Initialize Admin SDK

const db = admin.firestore();

exports.bookSlot = functions.https.onCall(async (data, context) => {
    // 1. Authentication Check: Ensure the user is logged in
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const userId = context.auth.uid;
    const slotId = data.slotId;

    if (!slotId) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a slotId.');
    }

    // Use a Firestore Transaction for atomic updates
    try {
        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const slotRef = db.collection('slots').doc(slotId);

            // 2. Read User and Slot documents within the transaction
            const userDoc = await transaction.get(userRef);
            const slotDoc = await transaction.get(slotRef);

            // 3. Check if documents exist and slot is available
            if (!userDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'User document not found.');
            }
            if (!slotDoc.exists) {
                 throw new functions.https.HttpsError('not-found', 'Slot document not found.');
            }

            const userData = userDoc.data();
            const slotData = slotDoc.data();

            if (slotData.isBooked) {
                throw new functions.https.HttpsError('already-exists', 'This slot is already booked.');
            }

            const requiredCredits = slotData.costCredits || 0; // Assume 0 if costCredits is missing
            const currentUserCredits = userData.credits || 0; // Assume 0 if credits is missing

            // 4. Check for sufficient credits
            if (currentUserCredits < requiredCredits) {
                throw new functions.https.HttpsError('failed-precondition', 'Not enough credits to book this slot.');
            }

            // 5. Perform updates within the transaction
            // Deduct credits from user
            const newUserCredits = currentUserCredits - requiredCredits;
            transaction.update(userRef, {
                credits: newUserCredits,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Mark slot as booked
            transaction.update(slotRef, {
                isBooked: true,
                bookedBy: userId,
                bookedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 6. (Optional) Add booking record
            const bookingRef = db.collection('bookings').doc(); // Auto-generate ID
             transaction.set(bookingRef, {
                 userId: userId,
                 slotId: slotId,
                 studioId: slotData.studioId, // Assuming studioId is on the slot document
                 slotStartTime: slotData.startTime,
                 slotEndTime: slotData.endTime,
                 creditsDeducted: requiredCredits,
                 bookingTimestamp: admin.firestore.FieldValue.serverTimestamp()
             });


            // 7. Return success response
            return { success: true, message: 'Slot booked successfully!' };

        });

        return result; // Return the result from the transaction

    } catch (error) {
        console.error("Transaction failed: ", error);
         // Re-throw HttpsError or throw a generic error
        if (error.code) {
             throw error; // Re-throw Firebase HttpsError (e.g., unauthenticated, failed-precondition)
        } else {
             throw new functions.https.HttpsError('internal', 'An internal error occurred during the booking process.');
        }
    }
});
