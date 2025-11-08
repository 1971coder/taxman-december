export interface ResolveRateInput {
  clientId: string;
  employeeId: string;
  issueDate: Date;
}

export async function resolveRate(
  _db: unknown,
  _input: ResolveRateInput
): Promise<number | null> {
  // TODO: implement once repositories are in place.
  return null;
}
