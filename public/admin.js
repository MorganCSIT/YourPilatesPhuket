document.addEventListener('DOMContentLoaded', () => {
    const adminUid = "8kGKHeMUAeXynvGA75lhODvOJ7L2"; // Replace with your actual admin UID
    const usersTableBody = document.getElementById('users-table-body');

    // Check if user is logged in and is the admin
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            if (user.uid === adminUid) {
                console.log("Admin user signed in:", user.uid);
                fetchAndDisplayUsers();
            } else {
                console.log("User is not admin, redirecting.");
                // Redirect non-admin users
                window.location.href = "account.html"; // Or another page
            }
        } else {
            console.log("No user signed in, redirecting to login.");
            // Redirect to login page if no user is signed in
            window.location.href = "account.html"; // Or your login page
        }
    });

    async function fetchAndDisplayUsers() {
        try {
            const usersRef = firebase.firestore().collection('users');
            const snapshot = await usersRef.get();

            if (snapshot.empty) {
                console.log('No users found.');
                usersTableBody.innerHTML = '<tr><td colspan="4">No users found.</td></tr>';
                return;
            }

            snapshot.forEach(doc => {
                const user = doc.data();
                const userId = doc.id;
                const row = usersTableBody.insertRow();

                row.innerHTML = `
                    <td>${user.email || 'N/A'}</td>
                    <td>${user.credits || 0}</td>
                    <td><input type="number" id="credits-${userId}" value="0" min="0"></td>
                    <td><button onclick="updateCredits('${userId}')">Update</button></td>
                `;
            });

        } catch (error) {
            console.error("Error fetching users:", error);
            usersTableBody.innerHTML = `<tr><td colspan="4">Error loading users: ${error.message}</td></tr>`;
        }
    }

    // This function will be called when the "Update" button is clicked
    window.updateCredits = async (userId) => {
        const creditInput = document.getElementById(`credits-${userId}`);
        const creditsToAdd = parseInt(creditInput.value, 10);

        if (isNaN(creditsToAdd) || creditsToAdd < 0) {
            alert("Please enter a valid number of credits.");
            return;
        }

        try {
            const userRef = firebase.firestore().collection('users').doc(userId);
            // Use a transaction to ensure atomic update
            await firebase.firestore().runTransaction(async (transaction) => {
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists) {
                    throw "Document does not exist!";
                }
                const currentCredits = userDoc.data().credits || 0;
                const newCredits = currentCredits + creditsToAdd;
                transaction.update(userRef, { credits: newCredits });
            });

            console.log(`Credits updated for user ${userId}. Added ${creditsToAdd}.`);
            // Optionally, refresh the user list or update the specific row
            // For simplicity now, we'll just log. A more robust solution would update the displayed value.
             alert("Credits updated successfully!");
             // You might want to refresh the list after update, or just update the specific row in the UI
             // For now, let's just clear the input field
             creditInput.value = 0;


        } catch (error) {
            console.error("Error updating credits:", error);
            alert(`Error updating credits: ${error.message}`);
        }
    };

});
