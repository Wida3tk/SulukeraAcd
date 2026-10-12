// OAuth service-account tokens must use Bearer authentication, not Firebase's ID-token auth parameter.
export async function readGraduationDirectory(databaseUrl,path,token,fetcher=fetch){
 const response=await fetcher(`${databaseUrl}/${path}.json`,{headers:{Authorization:`Bearer ${token}`}});
 if(!response.ok){const error=new Error('PROJECT_DIRECTORY_UNAVAILABLE');error.status=503;throw error;}
 return response.json();
}
