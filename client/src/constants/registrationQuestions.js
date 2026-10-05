/**
 * Sri Lankan universities preset for event registration dropdown questions.
 * Used by admin forms to one-click insert a standard university list.
 */

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
  "National School of Business Management (NSBM)",
  "Horizon Campus",
  "Other",
];

/** NSBM — student ID lookup applies to teammates from this university only. */
export const NSBM_UNIVERSITY = "National School of Business Management (NSBM)";

export const isNsbmUniversity = (university) => university === NSBM_UNIVERSITY;

/** Universities available on guest signup (all except NSBM). */
export const EXTERNAL_UNIVERSITIES = SRI_LANKAN_UNIVERSITIES.filter((u) => u !== NSBM_UNIVERSITY);

/** Team registration — university label (once per team). */
export const TEAM_UNIVERSITY_LABEL = "Which university is your team from?";

/** Pre-built registration question preset (reference for team registration). */
export const UNIVERSITY_QUESTION_PRESET = {
  question: TEAM_UNIVERSITY_LABEL,
  questionType: "dropdown",
  isRequired: true,
  options: [...SRI_LANKAN_UNIVERSITIES],
};

/** Detects duplicate university custom questions on individual events. */
export const isUniversityRegistrationQuestion = (question) =>
  /which university|university are you from/i.test((question?.question ?? "").trim());

export const QUESTION_TYPE_LABELS = {
  text: "Text",
  yes_no: "Yes / No",
  multiple_choice: "Multiple choice",
  checkbox: "Checkbox",
  dropdown: "Dropdown",
};

export const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABELS);
