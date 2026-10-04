/** Sri Lankan universities — shared with client registrationQuestions.js */

export const NSBM_UNIVERSITY = "National School of Business Management (NSBM)";

export const SRI_LANKAN_UNIVERSITIES = [
  "University of Colombo",
  "University of Peradeniya",
  "University of Sri Jayewardenepura",
  "University of Kelaniya",
  "University of Moratuwa",
  "University of Jaffna",
  "University of Ruhuna",
  "Eastern University, Sri Lanka",
  "Rajarata University of Sri Lanka",
  "Sabaragamuwa University of Sri Lanka",
  "Wayamba University of Sri Lanka",
  "Uva Wellassa University",
  "South Eastern University of Sri Lanka",
  "Open University of Sri Lanka",
  "Ocean University of Sri Lanka",
  "University of the Visual & Performing Arts",
  "University of Vavuniya",
  "Gampaha Wickramarachchi University of Indigenous Medicine",
  "Bhiksu University of Sri Lanka",
  "General Sir John Kotelawala Defence University",
  "Sri Lanka Institute of Information Technology (SLIIT)",
  "Informatics Institute of Technology (IIT)",
  NSBM_UNIVERSITY,
  "Horizon Campus",
  "Other",
];

/** Universities available for guest (non-NSBM) signup. */
export const EXTERNAL_UNIVERSITIES = SRI_LANKAN_UNIVERSITIES.filter((u) => u !== NSBM_UNIVERSITY);

export const isAllowedExternalUniversity = (university) =>
  EXTERNAL_UNIVERSITIES.includes(String(university ?? "").trim());
