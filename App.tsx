import React, { useState, useMemo, useEffect } from 'react';
import { Professor, CoreArea, Course, AssociationMap, BooleanAssociationMap } from './types';
import { PROFESSORS } from './constants';
import { analyzeCurriculum } from './services/geminiService';
import { ThumbsUpIcon, PlusCircleIcon, TrashIcon } from './components/icons';

const App: React.FC = () => {
  const [loggedInProfessor, setLoggedInProfessor] = useState<Professor | null>(null);

  const [coreAreas, setCoreAreas] = useState<CoreArea[]>(() => {
    try {
      const saved = localStorage.getItem('curriculum_coreAreas');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse coreAreas from localStorage", error);
      return [];
    }
  });
  const [courses, setCourses] = useState<Course[]>(() => {
    try {
        const saved = localStorage.getItem('curriculum_courses');
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.error("Failed to parse courses from localStorage", error);
        return [];
    }
  });
  const [associations, setAssociations] = useState<AssociationMap>(() => {
      try {
        const saved = localStorage.getItem('curriculum_associations');
        return saved ? JSON.parse(saved) : {};
    } catch (error) {
        console.error("Failed to parse associations from localStorage", error);
        return {};
    }
  });
  
  const [newCoreArea, setNewCoreArea] = useState('');
  const [newCourse, setNewCourse] = useState({ name: '', year: 1, semester: 1 });
  
  const [geminiAnalysis, setGeminiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(true);
  const [loginProfId, setLoginProfId] = useState<string>(PROFESSORS[0].id);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
    
  useEffect(() => {
    localStorage.setItem('curriculum_coreAreas', JSON.stringify(coreAreas));
  }, [coreAreas]);

  useEffect(() => {
    localStorage.setItem('curriculum_courses', JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem('curriculum_associations', JSON.stringify(associations));
  }, [associations]);

  const handleLogout = () => {
    setLoggedInProfessor(null);
    setIsLoginModalOpen(true);
  };

  const handleLoginAttempt = () => {
    if (loginPassword === '1234') {
      const professor = PROFESSORS.find(p => p.id === loginProfId);
      setLoggedInProfessor(professor || null);
      setIsLoginModalOpen(false);
      setLoginPassword('');
      setLoginError('');
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleAddCoreArea = () => {
    if (newCoreArea.trim() && loggedInProfessor) {
      const area: CoreArea = {
        id: `area_${Date.now()}`,
        name: newCoreArea.trim(),
        proposedBy: loggedInProfessor.id,
        votes: 0,
        votedBy: [],
      };
      setCoreAreas([...coreAreas, area]);
      setNewCoreArea('');
    }
  };

  const handleDeleteCoreArea = (areaIdToDelete: string) => {
    // Remove the core area
    setCoreAreas(prev => prev.filter(area => area.id !== areaIdToDelete));

    // Remove associations related to the deleted core area
    setAssociations(prev => {
      const newAssociations: AssociationMap = {};
      for (const courseId in prev) {
        if (Object.prototype.hasOwnProperty.call(prev, courseId)) {
          newAssociations[courseId] = { ...prev[courseId] };
          if (newAssociations[courseId][areaIdToDelete]) {
            delete newAssociations[courseId][areaIdToDelete];
          }
        }
      }
      return newAssociations;
    });
  };

  const handleVote = (areaId: string) => {
    if (!loggedInProfessor) return;
    setCoreAreas(prevAreas =>
      prevAreas.map(area => {
        if (area.id === areaId) {
          const hasVoted = area.votedBy.includes(loggedInProfessor.id);
          if (hasVoted) {
            // Un-vote
            return {
              ...area,
              votes: area.votes - 1,
              votedBy: area.votedBy.filter(id => id !== loggedInProfessor.id),
            };
          } else {
            // Vote
            return {
              ...area,
              votes: area.votes + 1,
              votedBy: [...area.votedBy, loggedInProfessor.id],
            };
          }
        }
        return area;
      })
    );
  };

  const handleAddCourse = () => {
    if (newCourse.name.trim() && loggedInProfessor) {
      const course: Course = {
        id: `course_${Date.now()}`,
        name: newCourse.name.trim(),
        year: newCourse.year,
        semester: newCourse.semester,
        proposedBy: loggedInProfessor.id,
      };
      setCourses([...courses, course]);
      setNewCourse({ name: '', year: 1, semester: 1 });
    }
  };

  const handleDeleteCourse = (courseIdToDelete: string) => {
    // Remove the course
    setCourses(prev => prev.filter(course => course.id !== courseIdToDelete));

    // Remove associations for the deleted course
    setAssociations(prev => {
        const newAssociations = { ...prev };
        if (newAssociations[courseIdToDelete]) {
            delete newAssociations[courseIdToDelete];
        }
        return newAssociations;
    });
  };


  const handleAssociationChange = (courseId: string, areaId: string) => {
    if (!loggedInProfessor) return;

    setAssociations(prev => {
      const newAssociations = JSON.parse(JSON.stringify(prev));
      
      if (!newAssociations[courseId]) {
        newAssociations[courseId] = {};
      }
      if (!newAssociations[courseId][areaId]) {
        newAssociations[courseId][areaId] = [];
      }

      const professorId = loggedInProfessor.id;
      const voters: string[] = newAssociations[courseId][areaId];
      const voterIndex = voters.indexOf(professorId);

      if (voterIndex > -1) {
        voters.splice(voterIndex, 1);
      } else {
        voters.push(professorId);
      }
      
      return newAssociations;
    });
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setGeminiAnalysis('');

    const booleanAssociations: BooleanAssociationMap = {};
    for (const courseId in associations) {
      if (Object.prototype.hasOwnProperty.call(associations, courseId)) {
        booleanAssociations[courseId] = {};
        for (const areaId in associations[courseId]) {
          if (Object.prototype.hasOwnProperty.call(associations[courseId], areaId)) {
            booleanAssociations[courseId][areaId] = (associations[courseId][areaId]?.length || 0) > 0;
          }
        }
      }
    }
    
    const result = await analyzeCurriculum(coreAreas, courses, booleanAssociations);
    setGeminiAnalysis(result);
    setIsAnalyzing(false);
  };

  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => a.year - b.year || a.semester - b.semester);
  }, [courses]);
  
  const sortedCoreAreas = useMemo(() => {
    return [...coreAreas].sort((a, b) => b.votes - a.votes);
  }, [coreAreas]);

  return (
    <>
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-2xl z-50 w-full max-w-sm">
            <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">로그인</h2>
            <div className="space-y-4">
              <select
                value={loginProfId}
                onChange={(e) => setLoginProfId(e.target.value)}
                className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
              >
                {PROFESSORS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLoginAttempt()}
                placeholder="비밀번호"
                className="w-full p-3 border border-gray-600 bg-gray-700 text-white rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 placeholder-gray-400"
              />
            </div>
            {loginError && <p className="text-red-500 text-sm mt-2 text-center">{loginError}</p>}
            <div className="mt-6 flex flex-col space-y-2">
              <button onClick={handleLoginAttempt} className="w-full bg-sky-600 text-white px-4 py-3 rounded-md hover:bg-sky-700 transition">
                로그인
              </button>
              <button onClick={() => setIsLoginModalOpen(false)} className="w-full bg-gray-200 text-gray-700 px-4 py-3 rounded-md hover:bg-gray-300 transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
        <header className="bg-white shadow-md">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-sky-700">학과 커리큘럼 협업 도구</h1>
            <div className="flex items-center space-x-4">
              {loggedInProfessor ? (
                <>
                  <span className="text-sm sm:text-base text-gray-700">환영합니다, <strong>{loggedInProfessor.name}</strong></span>
                  <button onClick={handleLogout} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 transition text-sm">
                    로그아웃
                  </button>
                </>
              ) : (
                <button onClick={() => setIsLoginModalOpen(true)} className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 transition">
                  로그인
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="container mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Proposals */}
          <div className="lg:col-span-1 flex flex-col space-y-8">
            {/* Core Area Proposal */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-sky-800">1. 주요 진로 제안</h2>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newCoreArea}
                  onChange={(e) => setNewCoreArea(e.target.value)}
                  placeholder="예: 인공지능, 데이터 과학"
                  className="flex-grow p-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-600 placeholder-gray-400"
                  disabled={!loggedInProfessor}
                />
                <button onClick={handleAddCoreArea} className="bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 transition flex items-center space-x-2 disabled:bg-gray-400" disabled={!loggedInProfessor}>
                  <PlusCircleIcon className="w-5 h-5" />
                  <span>제안</span>
                </button>
              </div>
            </div>
            
            {/* Course Proposal */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-sky-800">2. 교과목 제안</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                  placeholder="과목명"
                  className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md focus:ring-sky-500 focus:border-sky-500 disabled:bg-gray-600 placeholder-gray-400"
                  disabled={!loggedInProfessor}
                />
                <div className="grid grid-cols-2 gap-4">
                  <select value={newCourse.year} onChange={(e) => setNewCourse({ ...newCourse, year: parseInt(e.target.value) })} className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md disabled:bg-gray-600" disabled={!loggedInProfessor}>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}학년</option>)}
                  </select>
                  <select value={newCourse.semester} onChange={(e) => setNewCourse({ ...newCourse, semester: parseInt(e.target.value) })} className="w-full p-2 border border-gray-600 bg-gray-700 text-white rounded-md disabled:bg-gray-600" disabled={!loggedInProfessor}>
                    {[1, 2].map(s => <option key={s} value={s}>{s}학기</option>)}
                  </select>
                </div>
                <button onClick={handleAddCourse} className="w-full bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 transition flex items-center justify-center space-x-2 disabled:bg-gray-400" disabled={!loggedInProfessor}>
                  <PlusCircleIcon className="w-5 h-5" />
                  <span>추가</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Main Content */}
          <div className="lg:col-span-2 flex flex-col space-y-8">
            {/* Core Area Voting */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-sky-800">3. 주요 진로 선호도 조사</h2>
              <div className="space-y-3">
                {sortedCoreAreas.length > 0 ? sortedCoreAreas.map(area => {
                  const proposedByProf = PROFESSORS.find(p => p.id === area.proposedBy);
                  const hasVoted = loggedInProfessor && area.votedBy.includes(loggedInProfessor.id);
                  return (
                    <div key={area.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div>
                        <p className="font-medium text-gray-900">{area.name}</p>
                        <p className="text-xs text-gray-500">제안자: {proposedByProf?.name}</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        {loggedInProfessor && loggedInProfessor.id === area.proposedBy && (
                            <button
                            onClick={() => handleDeleteCoreArea(area.id)}
                            className="p-2 rounded-full text-red-500 hover:bg-red-100 transition-colors"
                            aria-label="제안 삭제"
                            >
                            <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                        <span className="font-bold text-sky-600">{area.votes}</span>
                        <button
                          onClick={() => handleVote(area.id)}
                          disabled={!loggedInProfessor}
                          aria-pressed={hasVoted}
                          className={`p-2 rounded-full transition-colors duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed ${
                            hasVoted
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                          }`}
                        >
                          <ThumbsUpIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                }) : <p className="text-gray-500 text-center py-4">제안된 주요 진로가 없습니다.</p>}
              </div>
            </div>
            
            {/* Curriculum Table */}
            <div className="bg-white p-6 rounded-lg shadow-lg overflow-x-auto">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-sky-800">4. 커리큘럼 구성 (과목-주요 진로 연관성)</h2>
              {courses.length > 0 && coreAreas.length > 0 ? (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-200 text-gray-600 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 text-center">학년</th>
                      <th className="py-3 px-4 text-center">학기</th>
                      <th className="py-3 px-4">과목명</th>
                      {sortedCoreAreas.map(area => (
                        <th key={area.id} className="py-3 px-4 text-center whitespace-nowrap">{area.name}</th>
                      ))}
                      <th className="py-3 px-4 text-center">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortedCourses.map(course => (
                      <tr key={course.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-center font-medium text-gray-900">{course.year}</td>
                        <td className="py-3 px-4 text-center font-medium text-gray-900">{course.semester}</td>
                        <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{course.name}</td>
                        {sortedCoreAreas.map(area => (
                          <td key={area.id} className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <input
                                type="checkbox"
                                className="h-5 w-5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer disabled:cursor-not-allowed"
                                checked={loggedInProfessor ? (associations[course.id]?.[area.id] || []).includes(loggedInProfessor.id) : false}
                                onChange={() => handleAssociationChange(course.id, area.id)}
                                disabled={!loggedInProfessor}
                              />
                              <span className="text-sm font-semibold text-sky-700 w-4 text-left">
                                {associations[course.id]?.[area.id]?.length || 0}
                              </span>
                            </div>
                          </td>
                        ))}
                        <td className="py-3 px-4 text-center">
                          {loggedInProfessor && loggedInProfessor.id === course.proposedBy && (
                            <button
                              onClick={() => handleDeleteCourse(course.id)}
                              className="p-2 rounded-full text-red-500 hover:bg-red-100 transition-colors"
                              aria-label="과목 삭제"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                  <p className="text-gray-500 text-center py-4">과목과 주요 진로를 먼저 제안해주세요.</p>
              )}
            </div>
            
            {/* Gemini Analysis */}
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-sky-800">5. AI 기반 커리큘럼 분석</h2>
               <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || courses.length === 0 || coreAreas.length === 0}
                className="w-full bg-indigo-600 text-white px-4 py-3 rounded-md hover:bg-indigo-700 transition flex items-center justify-center space-x-2 disabled:bg-gray-400"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>분석 중...</span>
                  </>
                ) : (
                  <span>Gemini로 커리큘럼 분석하기</span>
                )}
              </button>
              {geminiAnalysis && (
                <div className="mt-6 p-4 bg-gray-50 rounded-md border">
                  <h3 className="text-lg font-semibold text-indigo-800 mb-2">분석 결과</h3>
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {geminiAnalysis}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default App;