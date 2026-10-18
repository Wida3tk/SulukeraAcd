export function studentLessonDeadline(lesson,student){
 const closesAt=student?.homeworkExtensions?.[lesson.id]?.closesAt;
 if(!closesAt||!Number.isFinite(Date.parse(closesAt))||Date.parse(closesAt)<=Date.parse(lesson.closes_at))return lesson;
 return {...lesson,closes_at:new Date(closesAt).toISOString(),originalClosesAt:lesson.closes_at,personalExtension:true};
}
