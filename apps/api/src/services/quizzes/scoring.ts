export type ScoringQuestion = {
  id: string;
  correctIndex: number;
  concept: string;
};

export type ScoringAnswer = { questionId: string; selectedIndex: number };

export function scoreQuiz(questions: ScoringQuestion[], answers: ScoringAnswer[]) {
  const selections = new Map(answers.map((answer) => [answer.questionId, answer.selectedIndex]));
  const correctCount = questions.filter(
    (question) => selections.get(question.id) === question.correctIndex
  ).length;
  const concepts = new Map<string, { incorrectCount: number; totalQuestions: number }>();
  for (const question of questions) {
    const current = concepts.get(question.concept) ?? { incorrectCount: 0, totalQuestions: 0 };
    current.totalQuestions += 1;
    if (selections.get(question.id) !== question.correctIndex) current.incorrectCount += 1;
    concepts.set(question.concept, current);
  }
  return {
    correctCount,
    score: Math.round((correctCount / questions.length) * 100),
    weakConcepts: [...concepts.entries()]
      .filter(([, value]) => value.incorrectCount > 0)
      .map(([concept, value]) => ({ concept, ...value }))
      .sort((a, b) => b.incorrectCount / b.totalQuestions - a.incorrectCount / a.totalQuestions)
  };
}
