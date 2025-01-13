const isJsonResponse = (response: Response) =>
  response.headers.get('Content-Type')?.startsWith('application/json');

export default isJsonResponse;
