/**
 * Fetches the exam details from your Laravel backend using the exam code.
 */
export async function parseGoogleForm(examCode) {
  try {
    // Make sure this matches your local Laravel server URL (e.g. http://127.0.0.1:8000/api)
    const response = await fetch(`http://127.0.0.1:8000/api/exams/code/${examCode}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Exam code not found or server error.');
    }

    const examRecord = await response.json();

    // Map your database response structure to the frontend exam session structure
    return {
      id: examRecord.id,
      title: examRecord.title,
      timeLimitMinutes: examRecord.duration_minutes || 30,
      maxViolations: examRecord.max_violations || 3,
      // Questions loaded from backend or fallback questions for your demo
      questions: [
        {
          id: 1,
          type: "multiple_choice",
          text: "What does API stand for in software architecture development?",
          options: [
            "Application Programming Interface",
            "Applied Program Integration",
            "Advanced Protocol Interaction",
            "Automated Process Integration"
          ]
        },
        {
          id: 2,
          type: "multiple_choice",
          text: "Which of the following is a key benefit of using a decoupled frontend-backend architecture?",
          options: [
            "Tighter database coupling",
            "Independent scaling and maintenance",
            "Elimination of security requirements",
            "Guaranteed zero network latency"
          ]
        },
        {
          id: 3,
          type: "multiple_choice",
          text: "In relational database design, what does a foreign key enforce?",
          options: [
            "Column uniqueness",
            "Referential integrity between tables",
            "Automatic indexing speed",
            "Encryption of sensitive user credentials"
          ]
        }
      ]
    };
  } catch (error) {
    console.error("Failed to fetch exam from Laravel backend:", error);
    throw new Error("Cannot reach the server. Please check your connection.");
  }
}