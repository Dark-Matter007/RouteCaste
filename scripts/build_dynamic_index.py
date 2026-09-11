"""Create app-serving shards from canonical dynamic_roads.csv (no new values)."""
from collections import defaultdict
from guntur_common import DATA,read_csv,write_csv
def main():
 groups=defaultdict(list)
 for row in read_csv(DATA/'processed/dynamic_roads.csv'):groups[(row['event_id'],row['timestamp'])].append(row)
 fields=list(next(iter(groups.values()))[0]) if groups else []
 for (event,timestamp),rows in groups.items():write_csv(DATA/'processed/dynamic_index'/f"{event}__{timestamp.replace(':','-')}.csv",rows,fields)
 print(f'indexed {len(groups)} event/time snapshots')
if __name__=='__main__':main()
