import { OfficeFrame } from "@/components/data/office-frame";
import { StudentProfile } from "@/components/students/student-profile";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <OfficeFrame scope="student" focusId={id}>
      <StudentProfile studentId={id} />
    </OfficeFrame>
  );
}
