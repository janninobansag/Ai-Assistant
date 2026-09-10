import { RefreshSession } from "../../models/refresh-session.js";
import { Subject } from "../../models/subject.js";
import { Material } from "../../models/material.js";
import { MaterialChunk } from "../../models/material-chunk.js";
import { Summary } from "../../models/summary.js";
import { Quiz } from "../../models/quiz.js";
import { QuizAttempt } from "../../models/quiz-attempt.js";
import { Conversation } from "../../models/conversation.js";
import { Message } from "../../models/message.js";
import { UsageDaily } from "../../models/usage-daily.js";
import { User } from "../../models/user.js";

export async function permanentlyDeleteAccount(userId: string): Promise<void> {
  await Promise.all([
    RefreshSession.deleteMany({ userId }),
    Subject.deleteMany({ userId }),
    Material.deleteMany({ userId }),
    MaterialChunk.deleteMany({ userId }),
    Summary.deleteMany({ userId }),
    Quiz.deleteMany({ userId }),
    QuizAttempt.deleteMany({ userId }),
    Conversation.deleteMany({ userId }),
    Message.deleteMany({ userId }),
    UsageDaily.deleteMany({ userId })
  ]);
  await User.deleteOne({ _id: userId });
}
