import { GoogleGenAI } from "@google/genai";
import { CoreArea, Course, BooleanAssociationMap } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

export const analyzeCurriculum = async (
  coreAreas: CoreArea[],
  courses: Course[],
  associations: BooleanAssociationMap
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

    const sortedCourses = [...courses].sort((a, b) => a.year - b.year || a.semester - b.semester);

    const curriculumData = sortedCourses.map(course => {
        const relatedAreas = coreAreas
            .filter(area => associations[course.id]?.[area.id])
            .map(area => area.name)
            .join(', ');
        return `- ${course.year}학년 ${course.semester}학기: ${course.name} (관련 주요 진로: ${relatedAreas || '없음'})`;
    }).join('\n');

    const prompt = `
      학과 커리큘럼 분석 요청:

      정의된 학생 주요 진로:
      ${coreAreas.map(area => `- ${area.name} (${area.votes}표)`).join('\n')}

      제안된 커리큘럼:
      ${curriculumData}

      위 정보를 바탕으로, 다음 항목에 대해 상세히 분석하고 전문가적인 의견을 제시해 주십시오:
      1.  **강점 분석:** 현재 커리큘럼이 정의된 주요 진로들을 얼마나 잘 커버하고 있습니까? 각 주요 진로와 과목 간의 연관성이 높아 보이는 부분은 무엇입니까?
      2.  **보완점 및 격차:** 특정 주요 진로에 비해 과목 수가 부족하거나 연관성이 낮은 부분이 있습니까? 학생들의 진로 역량을 강화하기 위해 어떤 과목이나 주제가 추가되면 좋을지 구체적인 예시를 들어 제안해 주십시오.
      3.  **종합 의견:** 커리큘럼의 전체적인 균형과 흐름에 대한 종합적인 평가와 발전 방향에 대한 제언을 부탁드립니다.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.error("Error analyzing curriculum with Gemini API:", error);
    return "커리큘큘럼 분석 중 오류가 발생했습니다. API 키 설정 및 네트워크 연결을 확인해주세요.";
  }
};
