const isJsonResponse = (response: Response) => {
  return response.headers.get('Content-Type')?.startsWith('application/json');
};

export default isJsonResponse;
